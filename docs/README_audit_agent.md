# ASO Audit Agent

A TypeScript chat-style audit workspace for Apple App Store listings. Paste a listing URL, confirm I've got the right app, and you get back a structured ASO report built from what's actually on the public store page, with honest labels for anything I had to guess at or couldn't find.

## Setup

You'll need Node.js 20.9+ and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open the local Next.js URL and paste an App Store link, e.g.:

```text
https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580
```

You don't need an LLM key to try it out. Without one, retrieval and scoring still run end-to-end; the report just labels the recommendations as the built-in fallback instead of AI-written ones.

## Environment

| Variable                                  | Required               | What it does                                                                                                  |
| ----------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `OPENAI_API_KEY`                          | For AI recommendations | Turns on the Mastra recommendation agent. Without it, the built-in fallback kicks in.                         |
| `MODEL_ID`                                | No                     | Which model to send to the OpenAI-compatible provider. Defaults to `gpt-5.4-nano`.                            |
| `RECOMMENDATION_BUDGET_MS`                | No                     | How long to wait on the model before giving up and using the fallback. Defaults to `25000` (25s).             |
| `OPENAI_BASE_URL`                         | No                     | Point at any OpenAI-compatible endpoint (e.g. NVIDIA NIM).                                                    |
| `SITE_URL`                                | No                     | Canonical origin for share-preview URLs. Falls back to Vercel deployment host variables if you don't set it.  |
| `DATABASE_URL`                            | For deployed runs      | Local `file:` libSQL/SQLite URL for dev, or a hosted `libsql://` URL in production.                           |
| `DATABASE_AUTH_TOKEN`                     | Hosted DB only         | Auth token for a remote LibSQL/Turso database.                                                                |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | No                     | Accepted as aliases for the hosted LibSQL credentials when `DATABASE_*` isn't set.                            |
| `FIRECRAWL_API_KEY`                       | No                     | Lets a Firecrawl v2 scrape fill in gaps when direct page enrichment comes up short.                           |

If you skip the LLM key, retrieval and scoring still run; the report just makes it obvious the recommendations came from the built-in fallback.

## Commands

```bash
npm run dev        # Next.js dev server
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # strict TypeScript
npm run test       # Vitest suite
npm run eval       # fixture contract evaluation
```

## Architecture

The App Router UI talks to thin API routes. `POST /api/app/metadata` fetches just enough to identify the app, starts a persisted Mastra run, and returns once the workflow suspends at the confirmation step. `POST /api/audit/run` resumes that same run after the user gives the go-ahead and handles the optional enrichment plus the full audit. `GET /api/audit/[id]` serves sequence-cursor progress events so the client can poll durably across serverless instances, and `GET /api/audit/[id]/export.md` builds a Markdown export from the stored result.

The audit code lives under `src/features/aso-audit`:

| Layer          | What's in it                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Schemas        | Zod-validated boundaries for metadata, evidence, dimensions, recommendations, results, events, and requests.                  |
| Services       | App Store retrieval and enrichment, competitor search, review availability, orchestration, export, and fallback recommendations. |
| Scoring        | Deterministic TypeScript math for all ten dimensions and the overall score.                                                   |
| Mastra         | Agent, tools, the suspended workflow, and a read-only `aso-strategist` skill workspace.                                       |
| Fixtures/tests | Stable Spotify, wellness, productivity, and partial-listing data to evaluate against.                                         |

Drizzle declares the tables; local SQLite holds audit runs, chat messages, workflow events, metadata JSON, final reports, and export timestamps. Mastra's LibSQL storage uses the same DB file for workflow snapshots.

## Vercel Deployment

The hosted version lives at [layers-aso-agent.vercel.app](https://layers-aso-agent.vercel.app/).

## Data Retrieval

- The **iTunes Lookup API** is the source of truth for identity, developer, icon, category, genres, ratings, description, release notes, version, and exposed screenshots.
- After confirmation, the public App Store product page gets fetched on a best-effort basis for the visible subtitle, event markup, and any preview-media URLs that are reachable. This enrichment never blocks confirmation.
- If that direct scrape comes up short and `FIRECRAWL_API_KEY` is set, a schema-constrained **Firecrawl v2** scrape takes a second shot at the same public signals: subtitle, promo text, preview media, events.
- **Public RSS reviews** are attempted. Whatever I can read gets reduced to bounded, excerpt-cited praise or complaint signals. If nothing comes back, the report falls back to just the rating/count data.
- **Competitors** are educated guesses from public iTunes Search results based on visible title and category terms. They're never represented as real Apple keyword rankings.

## Mastra Design

This follows Mastra's documented patterns for [agents](https://mastra.ai/docs/agents/overview), [using agents and tools in workflows](https://mastra.ai/docs/workflows/agents-and-tools), [suspend and resume](https://mastra.ai/docs/workflows/suspend-and-resume), and [workspace skills](https://mastra.ai/docs/workspace/skills).

- **Agent:** `asoAuditAgent` only writes recommendations. It gets the pre-computed scores and evidence; it doesn't fetch anything or decide scores itself.
- **Tools:** URL parsing, metadata fetching, review retrieval, competitor discovery, and deterministic scoring are all typed Mastra tools that the workflow drives. The tests verify that none of the deeper evidence or scoring tools run before confirmation.
- **Workflow:** `asoAuditWorkflow` owns the lifecycle and the persisted progress events. It runs the deterministic tools, suspends at `confirm-listing`, resumes after the user approves, hands recommendation generation to the agent, and persists the final report.
- **Skill:** `src/features/aso-audit/skills/aso-strategist/SKILL.md` is the canonical recommendation rubric, kept in a read-only Mastra workspace. Recommendation generation activates the skill in a bounded step before returning structured output. Generic filesystem/command workspace tools stay disabled.

## Deliberate Decisions

- **The weights are preserved, not flattened.** The supplied rubric adds up to 110 points. Rather than silently dropping or rescaling a dimension, the overall score keeps every weight intact and normalizes the total to 100.
- **Hidden data stays hidden.** Apple doesn't expose the iOS keyword field publicly, so it gets a low-confidence inferred treatment until a future input supplies the real thing.
- **Recommendations have to cite their work.** Agent drafts have to reference evidence IDs and either include a validated rewrite pair or explicitly say "no rewrite." Server validation throws out unknown evidence, identical or incomplete rewrites, and over-limit title/subtitle suggestions. It also quietly downgrades any unsupported `observed` or hidden-keyword claims before using a single corrective retry or falling back.
- **Generation has a budget.** Live synthesis and its corrective retry share one foreground window (`RECOMMENDATION_BUDGET_MS`, default 25s). Only the compact scored-evidence projection gets sent to the model. If the provider is slow or returns garbage near the deadline, the evidence-backed deterministic plan finishes the audit instead of dying as a serverless timeout.
- **The skill gets used on purpose.** Retrieval and scoring finish before the agent runs. The bounded synthesis loop activates the read-only `aso-strategist` skill first, then emits the structured recommendation result.
- **Structured output respects the skill boundary.** The first bounded step activates the skill tool; the second disables tools entirely and produces schema-constrained structured output. Zod parsing and evidence-reference validation remain the trust boundary.
- **Official GPT-5 requests favor low latency.** When using the official OpenAI endpoint, recommendation generation requests the lowest supported reasoning effort (`none` for GPT-5.1+ and `minimal` for original GPT-5 variants) plus low text verbosity. Deterministic scoring and validation already carry the correctness burden, so cranking reasoning higher just wastes time. Custom OpenAI-compatible endpoints don't get sent provider-specific settings.
- **Optional evidence is time-boxed.** Page enrichment, the Firecrawl fallback, reviews, and competitor discovery improve the report when they come back fast, and degrade to clearly-labelled partial/unavailable evidence when they don't, instead of blocking the foreground audit.
- **Confirmation is a hard boundary.** No review, competitor, scoring, or recommendation tool runs until the user confirms the app.
- **Progress is durable and cheap.** The client only reads persisted events past its latest sequence cursor, backs off when the tab is hidden, and keeps working even when requests bounce between serverless instances.
- **Latency is visible, not hand-waved.** Both the metadata-confirmation and full-audit durations are logged and shown in the report's provenance panel.

## Demo Script

1. Paste a real App Store URL. Call out the URL validation and the initial Apple metadata fetch.
2. Show the confirmation card and explain that hitting **Yep, run it** resumes a suspended Mastra workflow.
3. Approve the app and walk through the sequence-cursor progress updates as the audit runs.
4. Walk through the scorecard, the confidence badges, and the low-confidence hidden keyword field.
5. Open a before/after recommendation and show that the evidence it cites is something I actually pulled from the listing.
6. Talk through the competitor note (best-guess search results, not real rankings) and the Markdown export.
7. Open the Evidence tab. Provenance timings, the line between observed and inferred, and the built-in fallback that takes over when no provider key is configured.
