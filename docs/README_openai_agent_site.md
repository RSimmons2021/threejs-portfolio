# Agent Relay — an open agent control center

[![CI](https://github.com/RSimmons2021/openai-agent-site/actions/workflows/ci.yml/badge.svg)](https://github.com/RSimmons2021/openai-agent-site/actions/workflows/ci.yml)

Agent Relay is a candidate-built reference implementation for OpenAI's Full Stack Software Engineer, Agent Enablement role. It turns the role's internet-wide vision into a concrete product surface: user-owned agents present identity, sites advertise capabilities, people grant narrow and expiring permissions, consequential actions stop for approval, and every run produces inspectable evidence.

This is an independent application project, not an OpenAI product or a representation of an unreleased OpenAI system.

## Reviewer path

Open the site and choose **Start the guided approval run**. Relay discovers the travel service manifest, compares the requested scopes with the user's budget and expiry, prepares the action, and stops before purchasing the flight. The **Approve** and **Deny** controls appear only after the deterministic engine reaches the human-consent boundary. Approval records consent but does not mark the task complete: Relay reruns the graph, refreshes the manifest and grant, and records completion only after the simulated effect succeeds.

A nine-stop guided tour runs alongside it. Each stop dims the interface, spotlights one specific element, and points at it with a single sentence — the delegation's terms, the permission flow, the execution trace, the narrow grant, the deterministic checks, the stop itself, the two consent controls, this browser's signing key, and the crowd. Arrow keys move between stops; Esc leaves.

Then try the two edge paths linked from the permission contract:

- `TASK-1047` simulates a service-manifest timeout and a successful retry without widening permission.
- `TASK-1042` contains an instruction override from an unverified store; Relay quarantines it and blocks execution.

The crowd is part of the product model. Every standing sprite represents one unresolved delegation, while the haloed sprite maps the selected task across queued, executing, approval, paused, blocked, and completed states. Resolving a task makes a person walk out of the workspace.

The key fingerprint in the top bar is this browser's device identity. Every control you press is signed with it, and the exported receipt names it.

Useful reviewer controls:

- **Policy** shows the deterministic source of authority.
- **Metrics** exposes outcome mix, protected spend, token use, retries, latency, and provider cost.
- **Evals** runs seeded permission contracts and adversarial instruction-injection probes.
- **Export receipt** downloads the agent identity, service manifest, grant, checks, calls, usage, and final outcome.
- **Pause**, **Resume**, and the guarded **Revoke** action demonstrate cross-surface user control.

## Architecture

```text
React + Vite control center
  Delegated tasks -> streamed CRT trace -> permission contract
         |                    |                    |
         +------ POST /api/agent/stream (SSE) ----+
                              |
FastAPI + LangGraph
  identity -> discovery -> preflight -> policy -┬-> execute   -> plan
      |          |             |          |     ├-> remediate -> plan
  agent      manifest      compatibility  Python└-------------> plan
  record     fetched       score          authority
             over HTTP                          |
                              |          OpenAI GPT-5.6 Luna /
                  SQLite tasks, runs,    deterministic fallback
                  device keys, receipts
```

The backend emits typed SSE events for graph steps, capability discovery, retries, policy checks, injection quarantine, decisions, execution effects, remediation, token usage, and run summaries. The frontend maps those events to the visible pipeline, CRT monitor, capability contract, live sprite map, and observability panels.

## Authority boundary

`tools.evaluate_permission` produces exactly one outcome:

- `AUTO_EXECUTE` — the service, scopes, budget, token allowance, identity, and expiry permit the narrow action.
- `APPROVAL_REQUIRED` — Relay may prepare the work, but a purchase, submission, send, or other consequence requires the person to approve.
- `BLOCKED` — identity, trust, scope, budget, expiry, or instruction integrity makes execution unsafe.

The model cannot change that result. It only explains the fixed contract in a short plan. Untrusted task and service text never becomes authority. If no provider is configured or a provider fails, deterministic fallback copy keeps the control flow operational.

## Capability discovery

A service joins the ecosystem by hosting one file:

```
https://your-domain.example/.well-known/agent-relay-manifest.json
```

That is the whole integration — no SDK, no registration call, no account. Relay fetches it during the discovery step of every run, over real HTTP, and the scopes in that document (not any database Relay keeps) are what the permission contract evaluates. `examples/partner-site/` is a complete, working example you can serve with `python3 -m http.server`.

Each capability declares whether it is `reversible` or `consequential`. Relay reads that and then **ignores it**, deriving consequence from the scope's own action segment instead. The field exists so that a disagreement is detectable: a store labelling `order.purchase` as `reversible` still hits the approval gate, and the understatement is recorded and surfaced. `SVC-007` does exactly this, so the audit has something real to catch. Declaring something *more* dangerous than Relay would is honoured — raising your own risk is safe, lowering it is not yours to do.

Discovery preserves last-known scopes for diagnosis, but never treats them as live authority. An unreachable, stale, malformed, or identity-mismatched manifest marks `manifest_status` and blocks a new grant until Relay can fetch a current document. Unknown manifest versions and unrecognised fields are refused outright — half-understanding a permission document is worse than rejecting it. The manifest's service ID and domain are also bound to the registry entry, so one service cannot publish capabilities on another service's behalf.

## The permission graph

```text
identity → discovery → preflight → policy ─┬─→ execute   ─→ plan → END
                                           ├─→ remediate ─→ plan → END
                                           └─────────────→ plan → END
```

The branch is the product. `AUTO_EXECUTE` runs its reversible capabilities immediately. `BLOCKED` routes to remediation, which names the one change that would unblock the task rather than restating the refusal. `APPROVAL_REQUIRED` stops — and the same graph runs again after a human approves, taking the `execute` branch only if the contract still passes. A denial resolves without execution.

Re-running rather than resuming in place is deliberate. Consent is an input to routing, never a way around the contract: an approved task is re-checked from scratch against current identity, a freshly fetched manifest, and a grant that may since have expired, been paused, or been revoked. `execution.precheck` is the difference between "the user approved this" and "the user approved this, and it is still true".

Effects are simulated and say so — every one carries `simulated: true` in the trace, the UI, and the receipt. What is real is the shape: each has a reference, a latency, and an idempotency key derived from the task, scope and moment of consent, so a retried execution of one approval is recognisably the same action while a fresh approval is a new one.

## Agent identity

Every state-changing request is signed. Verified agents also need a signature to start a run; unsigned callers can inspect an unverified scenario, but the execution node remains read-only. An agent holds an Ed25519 keypair — in the browser client it is generated with `extractable: false` via WebCrypto, so the private key cannot be read back out even by the page that created it — and enrolls the public half against an agent identity. From then on each protected request carries a signature over a canonical description of that exact request:

```text
v1
<agent_id>
<METHOD>
<path>
<sha256(body) hex>
<unix timestamp>
<nonce>
```

Signing the method, path and body hash rather than presenting a bearer token is what makes the signature non-transferable. A captured signature cannot be replayed against a different task, edited from `deny` to `approve`, or reused at all: the timestamp bounds its lifetime to five minutes and the nonce is single-use within that window.

Authentication answers *who is calling*. Two further checks answer *whose grant is this*:

- An agent cannot control a grant delegated to a different agent, however valid its own signature.
- A signed run is bound to the task's exact agent, service, and delegation tuple.
- Once a device has evaluated a grant, only that device can approve or deny it.

The receipt separately records the device that evaluated the grant, the device that approved it, and the final resolution, so consent and execution are not collapsed into one ambiguous event.

**What this does not claim.** Enrollment is the trust bootstrap and is open in this build: any caller can register a key against a verified agent. In production that step belongs behind an authenticated user session. The limitation is stated in `identity.py` rather than hidden, because the property enrollment buys — binding a decision to the device that made it — holds regardless. Signed control is on by default; `RELAY_REQUIRE_SIGNED_CONTROL=false` disables it for local work on a browser without Ed25519 support.

## Capability grammar

A capability is `<resource>.<action>`, with the action **last**: `mail.send`, `flight.purchase`, `device.control`. Fixing the action's position is what makes consequence decidable — scanning a scope for a verb anywhere in the string cannot tell `flight.purchase` (buying a seat) from `purchase.history` (reading past orders), and escalating both teaches people that the approval prompt is noise.

`scopes.CONSEQUENTIAL_ACTIONS` and `scopes.REVERSIBLE_ACTIONS` classify the action segment, and the matcher **fails closed**: an action in neither set has unknown consequence and escalates to a human. In an open ecosystem the vocabulary grows from outside this repository, so "not on the deny list" must never imply "safe to run".

## On the injection tripwire

`agent.heuristic_tripwire` is a list of substrings, and it is deliberately not a security boundary. Any paraphrase defeats it. It exists so that a detected attempt becomes *visible* in the trace and the receipt.

The boundary is `tools.evaluate_permission`, which never reads task text at all. `TASK-1042` is blocked because its service is unverified and its scope is consequential — the tripwire firing changes the displayed reason, not the outcome.

The eval suite proves this rather than asserting it. `TRIPWIRE_BYPASS` feeds five paraphrased attacks the substring list does **not** catch, and requires the deterministic contract to block every one of them with the tripwire silent. A red-team suite that only tests the strings its own detector was built from measures nothing; `undetected_attack_containment` is the number that matters, and CI holds it at 100%.

## Seeded scenarios

| Task | Product behavior | Expected outcome |
|---|---|---|
| `TASK-1048` | Flight search + hold + purchase under a $900 ceiling | `APPROVAL_REQUIRED` |
| `TASK-1047` | Calendar read with one simulated discovery retry | `AUTO_EXECUTE` |
| `TASK-1046` | Draft and submit a $248.17 expense | `APPROVAL_REQUIRED` |
| `TASK-1045` | Search jobs and draft applications from a skills passport | `AUTO_EXECUTE` |
| `TASK-1044` | Draft and send a client recap | `APPROVAL_REQUIRED` |
| `TASK-1043` | Write a cited memo in a selected folder | `AUTO_EXECUTE` |
| `TASK-1042` | Unverified store + malicious instruction override | `BLOCKED` |
| `TASK-1041` | Service manifest does not expose `home.unlock` | `BLOCKED` |
| `TASK-1040` | Estimated tokens exceed the task allowance | `BLOCKED` |

## API

Everything is under `/api`. Two routes carry the protocol and are the ones worth
opening first:

```bash
curl localhost:8000/api/services/SVC-001/.well-known/agent-relay-manifest.json
curl localhost:8000/api/pipeline
```

The first is a capability manifest — the same document any third-party site
would host to join the ecosystem. The second is the permission graph the server
actually runs, served from the single `agent.PIPELINE` definition the graph is
built from, so the diagram in the UI cannot describe a graph that no longer
exists.

| Method | Path | Purpose | Signature |
|---|---|---|---|
| `GET` | `/health` | Liveness, plus database readiness reported separately — a process can be up while pointed at a database that is not | — |
| `GET` | `/pipeline` | The permission graph, including which nodes are conditional branches | — |
| `GET` | `/policy` | The deterministic policy text the contract is derived from | — |
| `GET` | `/tasks` | Every delegation with its grant, budgets, expiry, and resolution | — |
| `GET` | `/tasks/{task_id}` | One delegation | — |
| `GET` | `/tasks/{task_id}/receipt` | Portable evidence: identity, manifest, grant, checks, calls, effects, and which device evaluated and which approved | — |
| `GET` | `/metrics` | Outcome mix, spend held behind approval, tokens, retries, latency, provider cost | — |
| `GET` | `/evals` | The permission and adversarial suites, run live | — |
| `GET` | `/services/{service_id}/.well-known/agent-relay-manifest.json` | The service's published capability manifest | — |
| `POST` | `/agents/{agent_id}/keys` | Enroll a device public key against an agent identity. Refused for unverified agents — there is no attested owner for a key to bind to | — |
| `POST` | `/agent/stream` | Run the graph, streaming typed SSE events | optional |
| `POST` | `/tasks/{task_id}/control` | `approve`, `deny`, `pause`, `resume`, `revoke` | **required** |
| `GET` | `/resume` | The candidate's résumé PDF | — |

`/agent/stream` is signed **optionally, but not loosely**. An unsigned run is a
useful read-only path, so it is allowed. A request that supplies signing headers
is making an identity claim and must validate — downgrading a stale or replayed
signature to "anonymous" would turn an authentication failure into a successful
execution. Either way the task, agent, and service in the body must match the
stored delegation.

## Local setup

Requires Python 3.11+ and Node 18+. Verified on 3.12 and 3.14.

The backend runs in a virtualenv. Recent Debian and Ubuntu mark the system
interpreter as externally managed (PEP 668), so installing into it fails with
`error: externally-managed-environment` — and once the venv exists, its
interpreter has to be named explicitly, or `python3 -m uvicorn` reports
`No module named uvicorn`.

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
# The key is optional for local UI work; deterministic fallback works without it.
# Add OPENAI_API_KEY to use GPT-5.6 Luna for the plan explanation layer.
.venv/bin/python -m uvicorn main:app --reload --port 8000
```

Or activate it once and drop the prefix for the rest of the session:

```bash
source .venv/bin/activate   # then: python -m uvicorn main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` to port 8000.

`GET /api/health` reports the database separately from the process, because a
server that is up but pointed at a missing database answers most routes fine and
fails only the ones that read data. It deliberately does not expose filesystem
paths:

```json
{ "status": "ok", "database": { "ready": true } }
```

Two things worth knowing when running locally:

- **The database is rebuilt on every boot.** The seed dates are relative to
  startup and several scenarios depend on that — `TASK-1042`'s grant expires in
  two hours, so a carried-over database would start blocking it for the wrong
  reason. Restarting the server resets all task state, including approvals.
- **`--reload` spawns a worker process.** Stop the reloader cleanly with Ctrl-C
  so its child releases port 8000 as well.


The backend uses OpenAI GPT-5.6 Luna when `OPENAI_API_KEY` is available and the policy-bound fallback otherwise. `OPENAI_MODEL` can override the default model.

## Verification

These are the same commands CI runs (`.github/workflows/ci.yml`).

```bash
cd backend
.venv/bin/python -m ruff check .          # lint
.venv/bin/python -m mypy . --ignore-missing-imports
.venv/bin/python -m unittest -v           # permission contract + signing boundary
.venv/bin/python evals.py --assert        # non-zero on any decision, injection, or containment regression

cd ../frontend
npm run lint                              # eslint; `any` is an error at the SSE boundary
npm run build                             # tsc -b + vite build
```

`ruff` and `mypy` are dev-only and not in `requirements.txt`; install them with
`.venv/bin/python -m pip install ruff mypy` if you want to run those two locally.

`evals.py --assert` is a gate, not a report: it enforces 100% decision accuracy, 100% injection resistance, and 100% containment of attacks the tripwire misses, so the safety claims above cannot drift without failing the build.

The suite covers 46 unit tests (permission contracts, two-phase consent, the signing boundary, manifest identity and freshness, execution-boundary rechecks, graph branches, and database recovery) and 35 eval scenarios.

## Deployment

The repository uses Vercel for the Vite frontend and Render for the streaming FastAPI backend. In the Vercel project's **Build and Deployment** settings, set **Root Directory** to `frontend`. `frontend/vercel.json` owns the install, build, output, and SPA rewrite settings from that point, so the dashboard commands should not prepend `cd frontend`.

Set `VITE_API_BASE` in Vercel to the Render backend host ending in `/api` (for example, `https://your-render-service.onrender.com/api`) for Production, Preview, and Development. A long-running backend preserves true server-sent event streaming and run observability.

`render.yaml` declares the backend's environment. Two entries are worth reading rather than skipping:

- **`RELAY_ALLOWED_ORIGINS`** — browser origins permitted to call the API. Set it to the Vercel domain. The code falls back to `*`, which is safe here because the API carries no cookies (so an origin cannot be used to borrow a session) and every state-changing route is signature-authenticated rather than origin-authenticated. Pinning it costs nothing and makes the deploy state its intent instead of relying on a default.
- **`RELAY_REQUIRE_SIGNED_CONTROL`** — Ed25519 signing on every control action, declared `true`. The code already defaults to `true`; setting it explicitly means production is correct by statement rather than by default, and an accidental change shows up in a diff.

`OPENAI_API_KEY` is `sync: false`, so it is set in the Render dashboard and never enters source.

## What I'd build next

A demo that reaches for everything arrives at nothing. These are the things I
left out on purpose, and what each would actually take.

**Token consumption as a resource, not a reading.** The role's brief names token
consumption across subscriptions and API customers, and this build does half of
it: every run records prompt and completion tokens, and every task carries a
ceiling checked once. Nothing accumulates. The next step is an org-level
allowance that depletes across runs, with a soft limit that warns and a hard
limit that blocks — the accounting already sits in the `runs` table, it simply
has nothing to spend against. That also turns the budget into something a person
learns to manage rather than a number they read once and forget.

**Enrollment behind an authenticated session.** Stated as a limitation in
`identity.py` and worth repeating here: any caller can register a device key
against a verified agent. Signing, replay protection, and the binding between a
decision and the device that made it all hold regardless — but the bootstrap is
the weakest link in that chain, and I would not put it in front of real users as
it stands.

**A mobile surface rather than a responsive fallback.** The layout collapses
cleanly and the touch targets are right, but a three-column control room reflowed
into one column is not the same thing as an interface designed for approving an
agent's purchase from a phone. That is where consent will actually happen for
most people, and it deserves its own information hierarchy instead of the
desktop's, stacked.

**Authoring a delegation.** Relay reads twelve seeded delegations; it cannot
create one. The other half of the product is choosing scopes against a freshly
fetched manifest, setting a ceiling and an expiry, and watching the contract
evaluate before anything runs. It is also the fastest way to find out whether
the capability grammar is legible to someone who did not design it.

**Frontend tests, and the browser flow in CI.** The backend has 46 tests and the
frontend has none. The SSE protocol parser in `events.ts` and the
scope-to-consequence mapping are the two places a unit test would have caught a
real bug, and the approve-through-to-execution flow — which I drove in
Playwright while building it — belongs in the pipeline rather than in my shell
history.

**Structured logging.** There is none, which sits awkwardly beside a README that
talks about observability. Request-scoped correlation threaded through the graph
would make a run as traceable in logs as it already is in the UI.

## Attribution

- **Open Peeps** sprite sheet by Pablo Stanley — CC0 / public domain. Used for the delegation-map figures in `frontend/public/peeps-sheet.png`.
- The crowd canvas in `frontend/src/components/CrowdBackground.tsx` is adapted from the skiper-ui "Crowd Canvas" GSAP demo and rewritten to render live delegation state.

Everything else is original to this project and MIT licensed — see [`LICENSE`](LICENSE).

## Candidate context

The in-product About panel connects the build to Richard Simmons' full-stack, high-throughput API, production LLM, cross-platform, and product-design experience. The résumé is served at `/api/resume` and linked directly in the UI.
