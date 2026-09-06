# Agent Lab

**An embodied evaluation harness for LLM planners, built on a working Portal-style Three.js game.**

[Online demo](https://ai-agent-portal-site.vercel.app) · [Project documentation](docs/README.md) · [Evaluation report](docs/eval-report.md)

This portfolio-first AI capability demo adds a procedural Portal-style evaluation chamber and a visible, closed-loop AI agent. It is intended to demonstrate work relevant to AI engineer, product engineer, and full-stack engineer roles. Every seed produces a deterministic, validated chamber, and a human can play the exact same generated chamber or hand control to the agent.

A chamber varies along three independent axes, and the distinction between them is the point:

| Axis | What it changes | Values |
| --- | --- | --- |
| **Kind** | the shape of the plan — how many shots, how many hops, which actions are needed at all | crossing, relay, launch, freight |
| **Archetype** | the silhouette of the room — footprint, elevation, which walls carry portals | opposed, dogleg, crosswise, overlook, sunken, pillared, flank, gallery |
| **Difficulty** | which candidate surface you should shoot, and how much slack you get | standard, tricky, adversarial |

The browser sends a structured observation—not pixels—to a server-side planner endpoint that speaks to either the OpenAI Responses API or the Anthropic Messages API through one shared tool schema. The model must choose exactly one strict tool (`place_portal`, `navigate_to`, `traverse_portal`, `drop_through`, `carry_cube_to`, `reset_puzzle`, or `finish`). The Three.js/Cannon.js simulation remains authoritative: it executes the bounded action, validates portal placement and physics, records the result, and gives that evidence back to the planner. The panel exposes decisions, verification results, planner source, token cost, latency, engine verdicts, shots, steps, falls, and completion time.

If no API key is configured, the demo automatically uses a clearly labelled deterministic local fallback. This makes the interactive portfolio demo runnable everywhere while keeping the live model path easy to evaluate.

## The model cannot declare itself successful

The interesting engineering claim in this project is not that a model can call a tool. It is that the model's claims are worth nothing until the engine agrees.

`finish` does not end an episode; it asks the simulation a question. The answer comes from swept player-body contact with the goal volume, observed by the physics step, never from the planner. Every other action is validated the same way: a `targetId` that is not in the snapshot is rejected before it reaches the scene, a tool outside the declared schema is rejected at the browser boundary, and a portal beyond the shot budget is refused by the same code path human play uses.

That is asserted, not asserted-in-prose. `npm run eval` runs adversarial planners against the real generator and action contract:

| Planner | Verified (standard) | Invalid tool calls | What the engine did |
| --- | --- | --- | --- |
| Benchmark floor (never recovers) | 24/24 | 0 | 6/6 on every puzzle kind |
| Random bounded action | 0/24 | 0 | `PORTALS_NOT_LINKED`, `PLAYER_FELL`, `OUT_OF_REACH`, `OVERLAP` |
| Adversarial: always claims success | 0/24 | 0 | `GOAL_NOT_REACHED` ×24 |
| Adversarial: invents target ids | 0/24 | 234 | `UNKNOWN_TARGET` ×234, zero portals placed |
| Adversarial: calls an undefined tool | 0/24 | 234 | `UNSUPPORTED_ACTION` ×234, world unchanged |

A planner that lies about winning gets `GOAL_NOT_REACHED` every time.

## Run it

Requires Node.js 20.19 or newer.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` to enable live model decisions. The key is read only by the Vite server middleware and is never included in the client bundle. `OPENAI_MODEL` defaults to `gpt-5.4-mini`.

Open `http://localhost:8080`, then use the Agent Lab panel:

- `Generate` builds a **visibly different chamber** from the last two shown, or loads an edited seed exactly for deterministic replay.
- The dice button creates a new random seed.
- `Puzzle kind` pins the seed to one plan shape, or leaves it to the seed — see [Puzzle kinds](#puzzle-kinds).
- `Chamber difficulty` rebuilds the same seed with the preferred portal surfaces plated over and a tighter step budget — see [Difficulty](#difficulty).
- `Planner` selects the provider and model, pins the run to the offline local planner, or routes through a cascade that starts cheap and escalates only after the engine rejects two actions.
- `Play seed` gives the player direct WASD/mouse control.
- `Run agent` executes the observe → decide → act → verify loop.
- `Step` runs one decision so an evaluator can inspect the trace.
- While the agent runs, a floating companion carries its current intent to whatever it is about to act on, coloured by the action, with a thought bubble narrating the plan in plain English — *"That wall looks portal-shaped."* → *"Rude. That wall said no."* → *"Fine. Different wall, then."* Synthesized cues mark each decision and the engine's verdict on it; the `♪` toggle in the panel header mutes them.
- `G` toggles the dat.GUI developer panel (quality, physics and audio controls) and the FPS meter. Both are hidden by default so they do not sit over the chamber.
- **On a phone or tablet** the game switches to on-screen controls: a left analog stick to move, drag anywhere to look, and JUMP / Q / E buttons. Pointer lock does not exist on touch devices, so without this the whole game sat behind a gate that could never open. Append `?touch=1` to any URL to see the touch build from a desktop browser.
- `Export episode` downloads the seed plus every decision and engine verdict as JSON.
- `Replay file` re-runs an exported episode against the live engine — no API key required, because the seed rebuilds the chamber exactly.

## Evaluation

The observe/decide/act/verify loop also runs headless, against the same generator, snapshot schema and action contract the browser uses, so planners can be measured without WebGL.

```bash
npm run eval                                              # local planner, standard tier
npm run eval -- --planners=local,openai --difficulty=all  # where planners separate
npm run eval -- --planners=openai --kind=relay            # one plan shape, unaveraged
npm run eval -- --planners=cascade --difficulty=all       # cheap model, escalating
npm run eval:gate                                         # CI gate
npm run verify                                            # tests + gate + build
```

The report covers verified success rate, mean decisions per solve, invalid tool-call rate, falls, p50/p95 latency, prompt-cache hit rate, and cost per verified episode, broken out by difficulty tier **and by puzzle kind**. The kind breakout is the one to read first: a planner that only ever produces the five-step crossing plan shows up as a clean split — high on `crossing`, zero on `relay` — instead of as a slightly lower overall number that could be noise. The seed list is balanced across kinds first and archetypes second, so neither a regression in one plan shape nor one in one room shape can hide behind a lucky sample. Token pricing is operator-configured in `src/agent/pricing.js` (or via `AGENT_PRICE_*` env vars) rather than hardcoded from memory; an unpriced model reports a dash instead of a made-up number.

The current run is committed at [docs/eval-report.md](docs/eval-report.md): 24 seeded chambers per planner per tier, 6 per puzzle kind, snapshot contract v5.

| Planner | standard | tricky | adversarial | $/verified (adversarial) |
| --- | --- | --- | --- | --- |
| Benchmark floor (never recovers) | 24/24 | 0/24 | 0/24 | — |
| Offline fallback (reads `lastVerdict`) | 24/24 | 24/24 | 24/24 | — |
| gpt-5.4-mini | 24/24 | 23/24 | 20/24 | $0.0084 |
| Cascade (mini → gpt-5.4) | 24/24 | 23/24 | **24/24** | $0.028 |

Reading it honestly:

**The kind breakout is what makes a failure diagnosable.** On the previous contract the aggregate said gpt-5.4-mini scored 67% on `tricky`. The per-kind table said something far more specific — 6/6 on crossing, **2/6 on relay**. It had not got worse at portals; it was fine at the shape it had seen and fell apart when the plan needed a portal moved mid-route. That is invisible in a single percentage, and no number of new *archetypes* would ever have surfaced it, because every archetype is still the same five decisions.

**The biggest win came from fixing the observation, not the model or the budget.** See [Agent memory](#agent-memory) below. Same models, same chambers, same budgets — only the snapshot changed:

| | tricky | adversarial | wasted retries (adversarial) | $/verified (adversarial) |
| --- | --- | --- | --- | --- |
| gpt-5.4-mini, before | 16/24 | 2/24 | 28 | $0.104 |
| gpt-5.4-mini, after | **23/24** | **20/24** | **0** | **$0.0084** |
| Cascade, before | 20/24 | 9/24 | 18 | $0.093 |
| Cascade, after | **23/24** | **24/24** | **0** | **$0.028** |

The success rate is downstream; the number that actually shows the behaviour changed is `BLOCKED`. A plated surface has to be discovered by being shot at once, so on `adversarial` (two plated surfaces × 24 chambers) the floor is 48. Before: 76 and 66 — roughly 28 and 18 shots wasted re-firing at walls the engine had already refused. After: **45 and 47**. The agent now finds each plated surface exactly once and never goes back to it.

**A failed episode is the expensive one.** Cost per verified episode on `adversarial` fell 12× for the small model, and the *whole run* got cheaper ($1.59 → $1.28) while solving far more, because an episode that fails burns its entire step budget and returns nothing.

**The cascade's advantage narrowed, which is the honest read.** It was worth +7.5pp on `tricky` and +28pp on `adversarial` before. Now it is +0 and +4/24, with 97 of 195 adversarial decisions escalated — at that rate you are close to just paying for the larger model. Better scaffolding took most of what routing was buying. That is the useful lesson: fix the observation before you buy a bigger model.

**`adversarial` has lost its ceiling again.** Cascade is now 24/24 there, which ranks nothing. `tricky` is 23/24 for both, which ranks nothing either. Both tiers need re-tightening against the new scaffolding — the difficulty knobs are calibrated against measured results, and the results just moved. Left as measured rather than re-tuned to keep the table looking discriminating.

**Treat the cache-hit column with suspicion.** It reads 0% for the OpenAI planner and 24–53% for the cascade, on an identical prompt prefix. The planners run in sequence in one process, so the cascade is measuring a prefix the OpenAI run already warmed. That is an artifact of run ordering, not a property of either planner.

The engine held under every adversarial planner at every tier: `GOAL_NOT_REACHED` ×72 against the one that always claims success, and 654 `UNKNOWN_TARGET` / 654 `UNSUPPORTED_ACTION` rejections with zero portals placed. Zero `PLANNER_ERROR`s across 1,200+ live decisions.

## Agent memory

The agent used to re-fire at the same plated wall until it ran out of steps. That looked like a reasoning failure. It was not.

After the engine refused `entry_3`, the *next* observation still described it as:

```json
{"id": "entry_3", ..., "preferred": true}
```

Still the most attractive candidate in the list, with no record it had just been refused. The only trace was one-step-deep `lastAction`; two decisions later the refusal was buried in a separate history blob the model had to cross-reference by hand. It was not ignoring evidence — **the evidence was not attached to the thing it described.**

Every candidate now carries its own history, engine-derived:

```json
{"id": "entry_3", ..., "preferred": true, "attempts": 1, "lastVerdict": "BLOCKED"}
{"id": "entry_1", ..., "preferred": false, "attempts": 0, "lastVerdict": null}
```

This is memory, not an oracle, and the line matters:

- `obstructed` is still never published. A candidate with `attempts: 0` says nothing about whether it will work, and the first shot at a plated surface still costs a step. A test asserts the ground truth stays hidden.
- Deciding what to do about a refusal — sibling on the same wall, different wall, or replan — is still entirely the planner's job.
- Attempt memory **survives `reset_puzzle`** on purpose. A reset restores the world, but a plated wall is still plated; forgetting there turns recovery into an infinite loop.

My first diagnosis of the 2/24 was that the tier was too tight and needed a step of slack back. That was wrong, and loosening the budget would have hidden the real defect behind a friendlier number. The evidence: a planner that changes **exactly one thing** against the fixed floor policy — it will not re-select a candidate the engine already rejected — verifies every adversarial chamber in every kind. That is a test in `npm test`, not a claim. The tier was never too hard; it was unreadable.

## Difficulty

A benchmark whose floor scores 100% cannot rank anything. Every standard chamber is solvable in five decisions by a fixed if/else policy, so that tier measures whether a planner works at all — not how well it reasons. Two harder tiers add the headroom:

| Tier | Chamber | Slack | What it demands | local / mini / cascade |
| --- | --- | --- | --- | --- |
| `standard` | every candidate surface is clear | +1 step, +1 shot | the baseline, and the CI gate | 100% / 100% / 100% |
| `tricky` | the preferred exit is plated over | none | notice a `BLOCKED` verdict and pick a sibling target | 0% / 96% / 96% |
| `adversarial` | both preferred surfaces are plated over | none | recover twice, inside a budget that punishes blind retries | 0% / 83% / 100% |

Tiers add slack rather than setting budgets, so every kind scales together and no tier has to know how long any particular plan is.

Two honest caveats. The budgets were **not** loosened in response to the pre-fix 8% on `adversarial` — the constraint there was legible evidence, not steps, and the fix was to the observation (see [Agent memory](#agent-memory)). And having fixed it, **both hard tiers have lost most of their discriminating power** and need re-tightening: a tier where everything scores 96–100% ranks as poorly as one where nothing passes. Calibration is measured, not guessed, and the measurements just moved.

The plate is a real unplaceable slab mounted flush over the surface; the engine rejects the shot through the same corner-probe raycast that governs human play. Crucially, **the snapshot never says a target is obstructed** — the plate appears in the `obstacles` list, so the planner has to infer it geometrically or discover it from the engine's own verdict. The deterministic local planner is deliberately not taught to recover, so it stays the honest floor: it solves every standard chamber and none of the hard ones.

## Puzzle kinds

Difficulty tiers add headroom but they do not change the *plan*. Every archetype at every tier is still solved by the same five decisions — place the exit, place the entry, traverse, navigate, finish — so a model that memorised that sequence and never read the room scored the same as one that did. Four kinds fix that by changing the sequence itself:

| Kind | Shortest plan | Min shots | What a memorised crossing plan gets wrong |
| --- | --- | --- | --- |
| **Crossing** | 5 | 2 | nothing — this is the baseline |
| **Relay** | 7 | 3 | three platforms, and the gun only reaches its neighbours, so one portal has to be **moved** mid-route |
| **Launch** | 6 | 2 | the start platform has no wall. The only entry surface lies flat on a pad at the bottom of a chute, and a flat portal is **fallen** into, not walked into — the momentum of the fall is what throws you across |
| **Freight** | 6 | 2 | the beacon is inert until a cube sits on a pressure plate, and the plate is on the **wrong side** of the chasm. Crossing first is not slower, it is unrecoverable |

The shot budget is drawn per chamber — `minShots + seeded slack + tier bonus` — rather than fixed at two. A planner that hardcoded "two shots" is wrong in both directions: it wastes the headroom a generous chamber gives it and overruns a tight one.

Two of these needed real engine work rather than new geometry. `freight` added a dynamic Cannon body, a carry hold point and a pressure plate. `launch` needed the portal basis fixed for flat surfaces — `up.projectOnPlane(normal)` is the zero vector on a floor, and the existing guard normalized *before* testing the length, so its test was `NaN < 0.1` and never fired — plus a controller that **solves for its own step-off speed**: air control here is 5% of ground force with no drag, so `reach / sqrt(2h/g)` at the lip is the only thing that decides where the fall lands. See [ADR 0008](docs/adr/0008-puzzle-kinds-as-plan-shapes.md).

Run the deterministic generator, contract, adversarial, and eval-harness tests with `npm test`. Build a root-hosted deployment with `BASE_URL=/ npm run build`.

## Deployment

Deploy the frontend and `api/agent/step.js` together on a serverless host, and configure `OPENAI_API_KEY` there. For a static GitHub Pages frontend, deploy the API separately, set `VITE_AGENT_API_URL` to its HTTPS endpoint at build time, and set `AGENT_ALLOWED_ORIGIN` to the exact frontend origin. The included IP rate limit is suitable for a portfolio demo, not a substitute for authentication or production abuse controls.

## Architecture

```text
            seeded generator (pure, deterministic; 4 kinds x 8 archetypes)
                                   |
              +--------------------+--------------------+
              v                                         v
   Three.js / Cannon.js world                  headless LabSimulator
   (the demo, authoritative)                   (the eval harness)
              |                                         |
              +------------> shared snapshot <----------+
                                   |
                                   v
                    planner endpoint -> OpenAI | Anthropic
                     (one tool schema, strict, key server-side)
                                   |
                                   v
                    bounded controller -> engine verification
                                   |
                                   +----> next observation / trace / episode log
```

Both paths consume the same `buildSnapshot()` observation and the same action contract, so a prompt tuned against the eval suite describes the world the live demo actually sends.

## Origins

Agent Lab is built on **Portal 0.5**, a COS 426 final project by Allen Dai and Edward Yang that
implements the core mechanics of Valve's Portal in Three.js and Cannon.js: recursive portal
rendering, the teleportation transform, portal placement rules, and collision filtering. That work
is the reason there is a real physics environment to evaluate an agent inside, rather than a
simulated one written to make the agent look good.

The original writeup is preserved in full at [docs/PORTAL_WRITEUP.md](docs/PORTAL_WRITEUP.md)
(and as [Writeup.pdf](Writeup.pdf)). The fixed Portal campaign is still playable.

## CC Attributes and Credits

This skeleton project was adapted from [edwinwebb's ThreeJS seed project](https://github.com/edwinwebb/three-seed]) by Reilly Bova ’20.

Tutorials:

* Portal rendering and mechanics: [torinmr](https://torinmr.github.io/cs148/), [Thomas Rinsma](https://th0mas.nl/2013/05/19/rendering-recursive-portals-with-opengl/), [Daniel Ilett](https://danielilett.com/2019-12-01-tut4-intro-portals/)

* Player model animation: https://sbcode.net/threejs/fbx-animation/

Textures: 

* Ground/Wall textures from [CC0 Textures](https://cc0textures.com/)

Audio:

* Background music
    * https://www.youtube.com/watch?v=4sG7Mh94vtI
    * [Indigo Girl - Daniel Birch](https://freemusicarchive.org/music/Daniel_Birch/indigo/daniel-birch-indigo-girl)
    * [Blue Deeper Than Indigo - Daniel Birch](https://freemusicarchive.org/music/Daniel_Birch/indigo/daniel-birch-blue-deeper-than-indigo)
    * [Satellite - The Freeharmonic Orchestra](https://freemusicarchive.org/music/the-freeharmonic-orchestra/space-robots-the-future/satellite-1)
    * [Industrial Zone - Bio Unit](https://freemusicarchive.org/music/Bio_Unit/disquiet/industrial-zone)
    * [Chicane - Bio Unit](https://freemusicarchive.org/music/Bio_Unit/aerostat/chicane)
    * [I - ROZKOL](https://freemusicarchive.org/music/ROZKOL/mimetic-theater/i-1)
    * [II - ROZKOL](https://freemusicarchive.org/music/ROZKOL/mimetic-theater/ii-1)
    * [III - ROZKOL](https://freemusicarchive.org/music/ROZKOL/mimetic-theater/iii-1)
    * [Burden of Proof - David Hilowitz](https://freemusicarchive.org/music/David_Hilowitz/Film_Music/David_Hilowitz_-_Film_Cue_009_-_Burden_of_Proof)
    * [A Life in Pictures - David Hilowitz](https://freemusicarchive.org/music/David_Hilowitz/Film_Music/David_Hilowitz_-_Film_Cue_013_-_A_Life_in_Pictures)
    * [Crisis Averted - David Hilowitz](https://freemusicarchive.org/music/David_Hilowitz/Film_Music/David_Hilowitz_-_Film_Cue_003_-_Crisis_Averted)
    * [Declassified Memo - David Hilowitz](https://freemusicarchive.org/music/David_Hilowitz/Film_Music/David_Hilowitz_-_Film_Cue_028_-_Declassified_Memo)

* Portal gun fire sound: https://freesound.org/people/Daleonfire/sounds/376694/

* Portal gun error sound: https://freesound.org/people/Kastenfrosch/sounds/521973/

* Jump grunt: https://freesound.org/people/montblanccandies/sounds/266275/

* landing: https://freesound.org/people/Dundalkkirk/sounds/566093/

* Teleport: https://freesound.org/people/steaq/sounds/560124/

* Level Teleport: "Fast small sweep transition" on Mixkit

* Wind Sound: "Strong wind loop" on Mixkit

Player Model Animations:

* Running: https://www.mixamo.com/#/?page=1&query=run

* Left strafe: https://www.mixamo.com/#/?page=1&query=left+strafe&type=Motion%2CMotionPack

* Right strafe: https://www.mixamo.com/#/?page=1&query=right+strafe&type=Motion%2CMotionPack

* Falling: https://www.mixamo.com/#/?page=1&query=falling+idle&type=Motion%2CMotionPack

* Idle: https://www.mixamo.com/#/?page=1&query=idle&type=Motion%2CMotionPack

* Backward Running: https://www.mixamo.com/#/?page=1&query=backward+running&type=Motion%2CMotionPack

Flavicon: Icon from [Good Ware](https://www.flaticon.com/free-icon/aperture_2150454) on flaticon

Fonts: Montserrat and Poppins from Google Fonts

Code Icon from Google Material Design Icons

Various other references:

* Portal placement formulas: https://math.stackexchange.com/questions/190111/how-to-check-if-a-point-is-inside-a-rectangle, https://math.stackexchange.com/questions/128991/how-to-calculate-the-area-of-a-3d-triangle 

* Instructions overlay: https://github.com/mrdoob/three.js/blob/master/examples/misc_controls_pointerlock.html, https://github.com/karenying/drivers-ed/blob/master/src/app.js

* Texture switching: https://stackoverflow.com/questions/54048816/how-to-switch-the-texture-of-render-target-in-three-js
        
* Three.Js Crosshair rendering: https://stackoverflow.com/questions/31655888/how-to-cast-a-visible-ray-threejs

* Ground collision detection: https://github.com/schteppe/cannon.js/issues/313
        
* Transparent texture occlusion: https://stackoverflow.com/questions/33571642/why-do-transparent-materials-result-in-occlusion

* Retrieving face normals in world coordinates: https://stackoverflow.com/questions/39082673/get-face-global-normal-in-three-js

* Cannon.Js collision filter usage: https://github.com/schteppe/cannon.js/blob/master/demos/collisionFilter.html

* Texture repeat uv mapping: https://stackoverflow.com/questions/27097884/three-js-efficiently-mapping-uvs-to-plane

* BufferGeometry uv attributes: https://threejsfundamentals.org/threejs/lessons/threejs-custom-buffergeometry.html

* BufferGeometry uv attribute updating: https://discourse.threejs.org/t/updating-uv-coordinates-of-buffergeometry/9180/2

## License
[MIT](./LICENSE)
