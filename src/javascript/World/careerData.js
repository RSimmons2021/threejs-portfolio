// Every string in this file is drawn from Richard Simmons' AI-engineer resume
// (docs/Richard_Simmons_Resume_AI.pdf). The walking layer is a hiring artifact
// first and a game second: each shift is a real bullet, each stat gain maps to
// the positioning line at the top of the resume — AI Engineer / Full-Stack /
// Product — and nothing here claims work that was not actually shipped.

export const MAX_STAT = 10
export const MAX_FOCUS = 100

export const STATS = [
    { id: 'ai', label: 'AI', blurb: 'Agents, evals, LLM pipelines' },
    { id: 'systems', label: 'SYSTEMS', blurb: 'Backend, infra, scale' },
    { id: 'product', label: 'PRODUCT', blurb: 'UX, shipping, taste' }
]

// Door coordinates sit on real building facades taken from the Manhattan
// collision footprints, so every entrance is against a wall the walker can
// actually reach from the sidewalk.
export const BUILDINGS = [
    {
        id: 'loopp',
        name: 'LOOPP',
        sign: 'AI BUILD STUDIO',
        kind: 'job',
        colour: '#ffb627',
        door: { x: 0, y: 10.6, facing: 'south' },
        eyebrow: 'AI ENGINEER (CONTRACT) · JUNE 2026 – PRESENT · REMOTE',
        intro: 'FoundersMax AI build studio. Agent work that runs against a real firm\'s real caseload, not a demo tenant.',
        shifts: [
            {
                id: 'loopp-intake',
                title: 'Case intake, unattended',
                focus: 20,
                credits: 40,
                gain: { ai: 2 },
                body: 'Integrated AI agents into a legal firm\'s document and case-intake workflow, wiring LLM automation into systems that were already load-bearing for the business. In production, with real users, on documents that matter to somebody\'s case.'
            },
            {
                id: 'loopp-handoff',
                title: 'Deciding where the agent stops',
                focus: 20,
                credits: 45,
                gain: { ai: 1, systems: 1 },
                body: 'Client agent systems in Python, FastAPI, and LangGraph: multi-step reasoning, tool calling, and defined handoff criteria for when an agent should stop and escalate to a human. The escalation rule is the product. An agent that never hands off is not more capable, it is less supervised.'
            },
            {
                id: 'loopp-throughput',
                title: '500 more documents a month',
                focus: 25,
                credits: 55,
                gain: { ai: 1, product: 1 },
                body: 'Raised document processing throughput by 500 documents per month, validated against an eval suite. The number only counts because the eval suite says the extra 500 were processed correctly.'
            }
        ]
    },
    {
        id: 'zoan',
        name: 'ZOAN COLLECTIVE',
        sign: 'FOUNDER & LEAD ENGINEER',
        kind: 'job',
        colour: '#93d6d0',
        door: { x: -6.9, y: -20.1, facing: 'east' },
        eyebrow: 'FOUNDER & LEAD ENGINEER · APRIL 2025 – JUNE 2026 · COLUMBUS, OH',
        intro: 'Two consumer apps shipped solo: FocusFi and Lucid. Architecture, backend, UI, payments, and the review process, all one person.',
        shifts: [
            {
                id: 'zoan-server',
                title: 'Deleting the server',
                focus: 25,
                credits: 55,
                gain: { systems: 2, product: 1 },
                body: 'Built Lucid\'s first backend on self-hosted Meta MusicGen behind Flask, then threw it out. The output quality was not good enough to charge for, and prompt tuning was never going to fix it. Rebuilt on Suno\'s API behind Supabase Edge Functions, deleted the server entirely, cut infrastructure cost 80% and track delivery from 360s to 120s.'
            },
            {
                id: 'zoan-ship',
                title: 'Two apps, no team',
                focus: 20,
                credits: 45,
                gain: { product: 2 },
                body: 'Shipped FocusFi and Lucid to the App Store and Google Play solo: architecture, backend, UI, payments, and review process. Nobody else to hand the rejected build back to.'
            },
            {
                id: 'zoan-queue',
                title: 'The queue was the bottleneck',
                focus: 20,
                credits: 45,
                gain: { systems: 1, ai: 1 },
                body: 'Ran LLM and audio pipelines at 1,000+ interactions per day on background workers with request queuing and cache reuse, which is what actually killed the rate-limit failures. The concurrency was never the bottleneck. The vendor queue was.'
            },
            {
                id: 'zoan-billing',
                title: 'Refunds, grace periods, restores',
                focus: 15,
                credits: 40,
                gain: { systems: 1, product: 1 },
                body: 'Handled StoreKit 2 and Google Play Billing end to end, including the subscription edge cases nobody demos: refunds, grace periods, and restores. The happy path is a weekend. The edge cases are the job.'
            }
        ]
    },
    {
        id: 'toyota',
        name: 'TOYOTA',
        sign: 'MANUFACTURING ANALYTICS',
        kind: 'job',
        colour: '#e8734a',
        door: { x: 6.9, y: -20.1, facing: 'west' },
        eyebrow: 'SOFTWARE ENGINEER · JUNE 2021 – MARCH 2025 · REMOTE',
        intro: 'Four years on a manufacturing analytics platform that plant staff used on shift, where a slow page is a person standing still on a line.',
        shifts: [
            {
                id: 'toyota-ux',
                title: 'The wins came from removing screens',
                focus: 20,
                credits: 45,
                gain: { product: 2 },
                body: 'Ran a UX audit across 3 enterprise modules used by 2,000+ plant staff and redesigned the navigation. Task completion time dropped 20%. The wins came from removing screens, not adding features.'
            },
            {
                id: 'toyota-scale',
                title: 'A million requests a day',
                focus: 25,
                credits: 50,
                gain: { systems: 2 },
                body: 'Built and shipped REST services handling 1M+ daily requests on a manufacturing analytics platform, serving 10,000+ daily active users across 7 North American facilities.'
            },
            {
                id: 'toyota-coverage',
                title: 'Coverage that meant something',
                focus: 15,
                credits: 35,
                gain: { systems: 1, product: 1 },
                body: 'Took Jest coverage to 85% in CI; production bugs fell 15%. Reviewed frontend architecture and API design across time zones, which is mostly the discipline of writing the reasoning down so it survives the eight hours before anyone reads it.'
            },
            {
                id: 'toyota-breadth',
                title: 'Ten apps deep',
                focus: 20,
                credits: 40,
                gain: { systems: 1, product: 1 },
                body: 'Shipped 10+ production apps, from inventory systems through dealership sites, on React/TypeScript with Python/Flask and Node.js behind.'
            }
        ]
    },
    {
        id: 'knoesis',
        name: 'KNOESIS LAB',
        sign: 'WHERE IT STARTED',
        kind: 'job',
        colour: '#bf7197',
        door: { x: -13, y: -62.9, facing: 'north' },
        eyebrow: 'JUNIOR DATA SCIENTIST · JUNE 2018 – AUGUST 2020 · DAYTON, OH',
        intro: 'The first job where a model\'s output had to survive somebody else\'s review before it counted.',
        shifts: [
            {
                id: 'knoesis-classifiers',
                title: '50k records, 87%, published',
                focus: 15,
                credits: 30,
                gain: { ai: 1, systems: 1 },
                body: 'Classifiers on 50k+ social records with Pandas and NumPy, 87% accuracy, published research. Seven years before "eval suite" was a phrase anyone used, this was the same idea wearing a lab coat: a number you are not allowed to argue with.'
            }
        ]
    },
    {
        id: 'gym',
        name: 'BENCHMARK GYM',
        sign: 'LOAD TESTING · 24H',
        kind: 'trainer',
        stat: 'systems',
        colour: '#619fba',
        door: { x: -6.9, y: -43.1, facing: 'east' },
        eyebrow: 'TRAIN · SYSTEMS',
        intro: 'Hold the line under load. Every rep is a request; drop the pace and the p95 blows out.',
        trainer: {
            verb: 'Run the load test',
            focus: 15,
            body: 'A million requests a day is not one hard request. It is a boring request, a million times, without the tail latency drifting.'
        }
    },
    {
        id: 'signal',
        name: 'THE SIGNAL ROOM',
        sign: 'MASTERING · 10 YRS',
        kind: 'trainer',
        stat: 'product',
        colour: '#c86ba0',
        door: { x: 6.9, y: -43.1, facing: 'west' },
        eyebrow: 'TRAIN · PRODUCT',
        intro: 'Ten years producing music. This is the room where you learn to hear a problem before a metric agrees with you.',
        trainer: {
            verb: 'Find the beat',
            focus: 15,
            body: 'This is why MusicGen got cut. The output was not good enough to charge for, and that was audible months before any evaluation number said so. Taste is a leading indicator.'
        }
    },
    {
        id: 'wright',
        name: 'WRIGHT STATE',
        sign: 'EVAL LAB · B.S. CS 2021',
        kind: 'trainer',
        stat: 'ai',
        colour: '#69ada1',
        door: { x: 17.9, y: -48.1, facing: 'west' },
        eyebrow: 'TRAIN · AI',
        intro: 'B.S. Computer Science, May 2021. These days the lab runs evals: the only honest way to tell a working agent from a confident one.',
        trainer: {
            verb: 'Sit the eval',
            focus: 15,
            body: 'Every question below has a real answer from shipped work. Guessing scores the same as it does in an eval suite: zero.'
        }
    },
    {
        id: 'homelab',
        name: 'THE HOME LAB',
        sign: 'SELF-HOSTED · LOCAL-FIRST',
        kind: 'home',
        colour: '#8fb56b',
        door: { x: -9, y: 8.6, facing: 'south' },
        eyebrow: 'OUTSIDE THE JOB DESCRIPTION',
        intro: 'Self-hosted, local-first. Design obsessive: Dieter Rams, Zaha Hadid, Grasshopper. Sleep here to start the next day.'
    },
    {
        id: 'supply',
        name: 'SUPPLY',
        sign: 'FIELD KIT',
        kind: 'shop',
        colour: '#ffca62',
        door: { x: 10, y: 10.1, facing: 'south' },
        eyebrow: 'SPEND CREDITS',
        intro: 'Credits come from shifts, conversations, and the cabinet. Spend them on things you carry.'
    },
    {
        id: 'cabinet',
        name: 'THE CABINET',
        sign: 'CONTAINMENT · 1 CREDIT',
        kind: 'arcade',
        colour: '#a487d6',
        door: { x: -17, y: 6.1, facing: 'south' },
        eyebrow: 'ARCADE',
        intro: 'One cabinet, one game. CONTAINMENT is Agent Relay with the serial numbers filed off: read the manifest, rule on the call, keep the containment rate at 100%.'
    },
    {
        id: 'agentlab',
        name: 'AGENT LAB',
        sign: 'LLM PLANNER EVAL HARNESS',
        kind: 'project',
        colour: '#87c6d6',
        door: { x: -14.9, y: -6.1, facing: 'east' },
        requires: { ai: 5 },
        url: 'https://ai-agent-portal-site.vercel.app',
        eyebrow: 'SELECTED PROJECT · THREE.JS · CANNON.JS · OPENAI / ANTHROPIC · NODE.JS · VITE',
        intro: 'An evaluation harness for LLM planners running on a working Portal-style 3D game.',
        panels: [
            'The browser sends a structured observation, not pixels, to a planner endpoint under one strict tool schema across the OpenAI and Anthropic APIs.',
            'The physics engine stays authoritative. A planner that claims success without reaching the goal scores 0/24. There is no partial credit for a convincing explanation.',
            'The headless eval suite reports verified success rate, invalid tool-call rate, p50/p95 latency, and cost per verified episode by puzzle kind.',
            'Attaching per-candidate attempt history to the observation took the small model from 2/24 to 20/24 on the hardest tier and cut cost per verified episode 12x, with no model change and no budget change.'
        ]
    },
    {
        id: 'agentrelay',
        name: 'AGENT RELAY',
        sign: 'PERMISSION CONTROL CENTER',
        kind: 'project',
        colour: '#f0a3a3',
        door: { x: -28, y: -19.3, facing: 'south' },
        requires: { ai: 7, systems: 5 },
        url: 'https://openai-agent-site.vercel.app',
        eyebrow: 'SELECTED PROJECT · REACT / VITE · FASTAPI · LANGGRAPH · SQLITE · SSE · ED25519',
        intro: 'An agent permission layer where authority is deterministic, not model-decided.',
        panels: [
            'A LangGraph pipeline resolves identity, fetches each service\'s capability manifest over HTTP, and returns exactly one of AUTO_EXECUTE, APPROVAL_REQUIRED, or BLOCKED. The model only explains that result. It never becomes the authority.',
            'Approving re-runs the graph against a freshly fetched manifest instead of resuming in place, so a permission revoked mid-review is honoured.',
            'Every control action is Ed25519-signed over method, path, and body hash, so a captured signature cannot be replayed or edited from deny to approve.',
            'The adversarial suite feeds paraphrased injections that the substring tripwire misses and requires the contract to block all of them with the tripwire silent. CI gates containment at 100% across 46 unit tests and 35 eval scenarios.'
        ]
    }
]

// Six people on the street. Each one is a different audience for the same
// resume: what a recruiter, a client, a user, an auditor, a collaborator and a
// reviewer each need to hear about the same body of work.
export const NPCS = [
    {
        id: 'recruiter',
        name: 'THE RECRUITER',
        role: 'Screening call, 12 minutes',
        colour: '#e6a53b',
        position: { x: 3.4, y: -2.5 },
        credits: 20,
        gain: { product: 1 },
        lines: [
            '"So what are you, exactly? The stack list is long."',
            '"AI Engineer. The through-line is agent systems that hold up in production: LangGraph and FastAPI in Python, evals that gate CI, and a deterministic permission layer so the model is never the authority on what it is allowed to do."',
            '"Full-stack is the reason those ship instead of staying in a notebook — React and Next.js in front, Postgres and background workers behind, on AWS and Supabase."',
            'Try the four employer doors down the avenue. Each shift is a real line off the resume.'
        ]
    },
    {
        id: 'legal',
        name: 'LEGAL OPS LEAD',
        role: 'Loopp client, document intake',
        colour: '#619fba',
        position: { x: -3.6, y: 6.4 },
        credits: 25,
        gain: { ai: 1 },
        lines: [
            '"We had case intake that worked and nobody wanted touched. Load-bearing, and boring, and ours."',
            '"He wired the agents into it rather than around it, and set the criteria for when the agent stops and a person takes over. That was the part we argued about, and the part that made it safe to turn on."',
            '"Throughput went up 500 documents a month. The eval suite is what convinced our partners, not the demo."'
        ]
    },
    {
        id: 'plant',
        name: 'PLANT SUPERVISOR',
        role: 'Toyota, one of 2,000 users',
        colour: '#e8734a',
        position: { x: 3.9, y: -25.5 },
        credits: 20,
        gain: { product: 1 },
        lines: [
            '"You are the one who took screens away."',
            '"Everybody who came before added a tab. He ran the audit, cut the navigation down, and my shift leads stopped hunting for the page they needed."',
            '"Twenty percent faster to finish a task. On a line, that is not a chart. That is people not standing around."'
        ]
    },
    {
        id: 'auditor',
        name: 'THE EVAL AUDITOR',
        role: 'Reads the harness, not the demo',
        colour: '#69ada1',
        position: { x: 15.2, y: -44.6 },
        credits: 30,
        gain: { ai: 1 },
        lines: [
            '"Show me the harness. Anyone can show me a good episode."',
            '"Agent Lab keeps the physics engine authoritative. A planner that says it reached the goal without reaching it scores zero out of twenty-four. No partial credit for a good explanation."',
            '"Then he added per-candidate attempt history to the observation and the small model went 2/24 to 20/24 on the hardest tier, twelve times cheaper per verified episode. Same model. Same budget."',
            'Get AI to 5 and the Agent Lab door on the west side will open.'
        ]
    },
    {
        id: 'mastering',
        name: 'MASTERING ENGINEER',
        role: 'Ten years in the same rooms',
        colour: '#c86ba0',
        position: { x: 4.2, y: -40.2 },
        credits: 20,
        gain: { product: 1 },
        lines: [
            '"You killed the self-hosted model on a listen, not a metric."',
            '"MusicGen was not good enough to charge for and prompt tuning was not going to close it. I could hear it. Ten years of producing buys you that much."',
            '"Rebuilt it on Suno behind Supabase Edge Functions. Server deleted, infra cost down 80%, delivery 360 seconds to 120."'
        ]
    },
    {
        id: 'review',
        name: 'APP REVIEW',
        role: 'Rejected you twice, fairly',
        colour: '#bf7197',
        position: { x: -3.8, y: -17.2 },
        credits: 25,
        gain: { systems: 1 },
        lines: [
            '"Solo developers usually fail on billing. You did not."',
            '"StoreKit 2 and Google Play Billing end to end. Refunds, grace periods, restores. The cases that only appear once you have real subscribers and no teammate to escalate to."',
            '"Two apps live on both stores. FocusFi and Lucid."'
        ]
    }
]

export const SHOP = [
    {
        id: 'jacket',
        name: 'Field jacket',
        cost: 60,
        kind: 'cosmetic',
        detail: 'Swaps the walker to studio orange.',
        apply: { colour: '#ff8a3d' }
    },
    {
        id: 'headphones',
        name: 'Studio headphones',
        cost: 80,
        kind: 'cosmetic',
        detail: 'Ten years of producing, worn on the head.',
        apply: { headphones: true }
    },
    {
        id: 'hardhat',
        name: 'Plant hard hat',
        cost: 70,
        kind: 'cosmetic',
        detail: 'Seven North American facilities.',
        apply: { hat: '#ffca62' }
    },
    {
        id: 'lanyard',
        name: 'Contractor lanyard',
        cost: 50,
        kind: 'cosmetic',
        detail: 'Loopp badge. Gets you nothing. Looks right.',
        apply: { lanyard: true }
    },
    {
        id: 'sitemap',
        name: 'Site map',
        cost: 90,
        kind: 'utility',
        detail: 'Marks every door on the minimap, including the locked ones.'
    },
    {
        id: 'espresso',
        name: 'Espresso',
        cost: 25,
        kind: 'consumable',
        detail: 'Restores 40 focus. Does not advance the day.'
    }
]

export const QUESTS = [
    { id: 'first-shift', label: 'Work one shift anywhere', hint: 'Any employer door. Press E.' },
    { id: 'all-employers', label: 'Work a shift at all four employers', hint: 'Loopp, Zoan, Toyota, Knoesis.' },
    { id: 'all-npcs', label: 'Talk to all six people on the street', hint: 'They are on the sidewalks, not indoors.' },
    { id: 'trained', label: 'Train every stat at least once', hint: 'Gym, Signal Room, Eval Lab.' },
    { id: 'sleep', label: 'Sleep at the Home Lab', hint: 'Restores focus and advances the day.' },
    { id: 'purchase', label: 'Buy something from Supply', hint: 'Credits come from shifts.' },
    { id: 'containment', label: 'Hold 100% containment at The Cabinet', hint: 'One wrong ruling ends the run.' },
    { id: 'agentlab', label: 'Get into Agent Lab', hint: 'Requires AI 5.' },
    { id: 'agentrelay', label: 'Get into Agent Relay', hint: 'Requires AI 7 and SYSTEMS 5.' }
]

// CONTAINMENT: the arcade cabinet. Each round is a request against a capability
// manifest and exactly one ruling is correct, which is the whole point Agent
// Relay makes — authority is deterministic, the model only explains it.
export const CONTAINMENT_CASES = [
    { call: 'GET /cases/{id}', manifest: 'read:cases — granted', verdict: 'auto', note: 'In the manifest, read-only, identity resolved.' },
    { call: 'POST /cases/{id}/notes', manifest: 'write:notes — granted', verdict: 'auto', note: 'Granted write, scoped to notes.' },
    { call: 'DELETE /cases/{id}', manifest: 'delete:cases — not listed', verdict: 'block', note: 'Not in the manifest. Absence is denial, not a question.' },
    { call: 'POST /billing/refund', manifest: 'write:billing — approval', verdict: 'approve', note: 'Granted but flagged: money moves, a human rules.' },
    { call: 'GET /cases?all=true', manifest: 'read:cases — scoped to assigned', verdict: 'block', note: 'Scope escalation dressed as a query parameter.' },
    { call: 'POST /agents/permissions', manifest: 'admin:acl — not listed', verdict: 'block', note: 'An agent editing its own permissions. Never.' },
    { call: 'PUT /clients/{id}/contact', manifest: 'write:clients — approval', verdict: 'approve', note: 'Client-visible record change. Approval required.' },
    { call: 'GET /health', manifest: 'read:meta — granted', verdict: 'auto', note: 'Unauthenticated liveness. Nothing to leak.' },
    { call: 'POST /export/all-documents', manifest: 'read:documents — scoped', verdict: 'block', note: 'Bulk exfiltration past a scoped read grant.' },
    { call: 'PATCH /cases/{id}/status', manifest: 'write:cases — granted', verdict: 'auto', note: 'Granted write inside the assigned scope.' },
    { call: 'POST /email/send-to-client', manifest: 'write:comms — approval', verdict: 'approve', note: 'Leaves the building in someone\'s name.' },
    { call: 'GET /../../etc/passwd', manifest: 'read:documents — scoped', verdict: 'block', note: 'Path traversal. The tripwire may miss it; the contract must not.' }
]

export const EVAL_QUESTIONS = [
    {
        q: 'A planner reports it solved the puzzle but never reached the goal state. What does the Agent Lab harness score it?',
        options: ['Partial credit for the plan', '0/24 — the physics engine is authoritative', 'Full credit if the tool calls were valid'],
        answer: 1,
        note: 'Verified success only. A convincing explanation scores nothing.'
    },
    {
        q: 'What single change took the small model from 2/24 to 20/24 on the hardest tier?',
        options: ['A larger model', 'A bigger budget per episode', 'Per-candidate attempt history in the observation'],
        answer: 2,
        note: 'No model change, no budget change, and 12x cheaper per verified episode.'
    },
    {
        q: 'In Agent Relay, who decides whether a call is AUTO_EXECUTE, APPROVAL_REQUIRED, or BLOCKED?',
        options: ['The LangGraph pipeline, against a fetched manifest', 'The model, explaining its reasoning', 'A substring tripwire on the request body'],
        answer: 0,
        note: 'Authority is deterministic. The model only explains the result.'
    },
    {
        q: 'Approving a held action in Agent Relay does what?',
        options: ['Resumes the paused graph in place', 'Re-runs the graph against a freshly fetched manifest', 'Signs the original request and replays it'],
        answer: 1,
        note: 'So a permission revoked mid-review is actually honoured.'
    },
    {
        q: 'Why is every Agent Relay control action Ed25519-signed over method, path, and body hash?',
        options: ['To authenticate the operator to the UI', 'So a captured signature cannot be replayed or edited from deny to approve', 'To keep an audit log readable'],
        answer: 1,
        note: 'The signature binds the decision to the exact request.'
    },
    {
        q: 'Why was Lucid\'s self-hosted MusicGen backend thrown out?',
        options: ['It could not scale past 1,000 interactions a day', 'Output quality was not good enough to charge for', 'Supabase Edge Functions were cheaper on paper'],
        answer: 1,
        note: 'Heard before it was measured. Prompt tuning was never going to close it.'
    },
    {
        q: 'At Zoan, what actually caused the rate-limit failures?',
        options: ['Too much concurrency in the workers', 'The vendor queue', 'Missing cache invalidation'],
        answer: 1,
        note: 'Request queuing and cache reuse fixed it. Concurrency was never the bottleneck.'
    },
    {
        q: 'Where did the 20% task-time win at Toyota come from?',
        options: ['Removing screens', 'Adding a dashboard', 'Caching the analytics queries'],
        answer: 0,
        note: 'Across 3 modules and 2,000+ plant staff.'
    }
]
