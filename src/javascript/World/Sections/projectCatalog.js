// Shared by the 3D gallery and the reproducible billboard artwork generator.
const projects = [
    {
        slug: 'zoan', name: 'Zoan Collective', title: ['ZOAN', 'COLLECTIVE'],
        href: 'https://zoancollective.site', accent: '#bce685', secondary: '#f5d7a1',
        eyebrow: 'Independent design studio', role: 'Founder + design operator',
        problem: 'Founders need a clear connection between their brand, product, and the people using it.',
        built: 'A boutique studio for brand identity, product design, and systems grounded in seven principles of Zen design.',
        stack: 'Brand identity · product design · design systems',
        outcome: 'A coherent design direction that carries from the first impression into the product.',
        headlines: ['MAKE SOME / GOOD TROUBLE.', 'LESS NOISE. / MORE MEANING.', 'IDEA TO / IDENTITY.'],
        captions: ['Brand meets product.', 'Seven principles. One clear direction.', 'Design with a point of view.']
    },
    {
        slug: 'agent-lab', name: 'Agent Lab', title: ['AGENT', 'LAB'],
        href: 'https://ai-agent-portal-site.vercel.app/', accent: '#71e0f4', secondary: '#ffad60',
        eyebrow: 'Embodied AI evaluation', role: 'AI + full-stack engineering',
        problem: 'A planner claiming success is not evidence that its actions worked.',
        built: 'A playable Portal-style evaluation chamber where an AI plans, acts, observes, and retries against an authoritative physics engine.',
        stack: 'Three.js · Cannon.js · OpenAI / Anthropic · evaluation harness',
        outcome: 'Deterministic chambers, bounded tools, visible planner traces, and engine-verified outcomes. Includes a labeled local fallback.',
        headlines: ['THINK OUTSIDE / THE PORTAL.', 'PLAN. ACT. / PROVE IT.', 'HUMAN OR AI. / SAME RULES.'],
        captions: ['A playground for AI reasoning.', 'The engine gets the final say.', 'Play it. Then hand over the controls.']
    },
    {
        slug: 'deepseek', name: 'DeepSeek Harness Desktop', title: ['DEEPSEEK', 'DESKTOP'],
        href: 'https://github.com/RSimmons2021/deepseek-harness-desktop', accent: '#a6baff', secondary: '#b5f0e6',
        eyebrow: 'Open-source agent workspace', role: 'Desktop project · DeepSeek Harness fork',
        problem: 'Agent tools need a workspace that can grow as capabilities change.',
        built: 'A desktop-focused fork of the open-source DeepSeek Harness, built around its everything-is-a-plugin architecture.',
        stack: 'DeepSeek Harness · Cordis · plugin architecture',
        outcome: 'An inspectable repository for exploring a modular agent workspace and its desktop direction.',
        headlines: ['BIG IDEAS. / DESKTOP ENERGY.', 'EVERYTHING / IS A PLUGIN.', 'OPEN SOURCE. / OPEN POSSIBILITIES.'],
        captions: ['An agent workspace, on your terms.', 'Connect the pieces. Extend the workspace.', 'Explore the code on GitHub.']
    },
    {
        slug: 'agent-relay', name: 'Agent Relay', title: ['AGENT', 'RELAY'],
        href: 'https://openai-agent-site.vercel.app/', accent: '#f8b984', secondary: '#b9e6c1',
        eyebrow: 'Agent control center', role: 'Full-stack + agent systems engineering',
        problem: 'Delegating to agents requires clear identity, limited permissions, and an inspectable record of each action.',
        built: 'An independent reference application with signed agent identity, capability discovery, expiring grants, approval boundaries, and streamed execution traces.',
        stack: 'React · FastAPI · LangGraph · SSE · Ed25519',
        outcome: 'A guided simulated approval run, permission evaluations, and exportable evidence receipts. An independent project, unaffiliated with OpenAI.',
        headlines: ['THE AGENTS RUN. / YOU CALL IT.', 'TRUST HAS / A PAPER TRAIL.', 'DELEGATE. / STAY IN CONTROL.'],
        captions: ['A control center for delegated work.', 'Identity. Permission. Evidence.', 'Consequential actions stop for approval.']
    },
    {
        slug: 'lucid', name: 'Lucid', title: ['LUCID', 'SOUNDSCAPES'],
        href: 'https://www.lucid-app.xyz/', accent: '#c9b6ff', secondary: '#80e3e5',
        eyebrow: 'AI audio product', role: 'Product design + full-stack build',
        problem: 'Finding the right audio can become another task when someone wants to focus, reset, or wind down.',
        built: 'An audio-first web app pairing binaural beats with personalized AI-generated soundscapes.',
        stack: 'Responsive web app · audio UX · AI soundscapes',
        outcome: 'A direct path from choosing a listening state to starting a soundscape.',
        headlines: ['TUNE OUT. / DROP IN.', 'FIND YOUR / FREQUENCY.', 'LESS SCROLL. / MORE SOUL.'],
        captions: ['Sound for the state you want.', 'Focus. Reset. Sleep.', 'Your next listening ritual.'],
        prototype: { type: 'soundscape', prompt: 'Choose a listening state', options: [
            { label: 'Focus', value: 'Layered pulse · 40 Hz', tone: 'focus' },
            { label: 'Reset', value: 'Breathing space · 8 Hz', tone: 'reset' },
            { label: 'Sleep', value: 'Low drift · 3 Hz', tone: 'sleep' }
        ] }
    },
    {
        slug: 'aso-agent', name: 'ASO Audit Agent', title: ['ASO AUDIT', 'AGENT'],
        href: 'https://layers-aso-agent.vercel.app/', accent: '#f8d665', secondary: '#badcb9',
        eyebrow: 'App Store audit workspace', role: 'TypeScript + AI workflow engineering',
        problem: 'App Store recommendations need traceable evidence and a clear distinction between public facts and inference.',
        built: 'A chat-style audit workspace that confirms the listing, retrieves public evidence, scores ten dimensions, and returns a structured improvement report.',
        stack: 'Next.js · TypeScript · Mastra · Drizzle · LibSQL',
        outcome: 'Deterministic scoring, cited recommendations, durable progress, and Markdown export, with a labeled fallback when no model is available.',
        headlines: ['GREAT APP. / GET DISCOVERED.', 'LESS GUESSING. / MORE EVIDENCE.', 'SMALL EDITS. / CLEARER STORY.'],
        captions: ['Give your App Store listing a second look.', 'Ten dimensions. Traceable recommendations.', 'Audit. Understand. Improve.']
    }
]

export default projects

export const worldProjects = projects.map((project) => ({
    name: project.name,
    imageSources: ['a', 'b', 'c'].map((slide) => `./models/projects/${project.slug}/slide-${slide}.svg`),
    floorTexture: null,
    link: { href: project.href, x: -4.8, y: -3, halfExtents: { x: 3.2, y: 1.5 } },
    details: Object.fromEntries(['eyebrow', 'role', 'problem', 'built', 'stack', 'outcome'].map((key) => [key, project[key]])),
    theme: { accent: project.accent, secondary: project.secondary, floor: '#344957', matcap: '#e0e9ed', indirect: '#667b91', glow: project.accent },
    prototype: project.prototype || {
        type: 'principles', prompt: 'Explore the project', options: [
            { label: 'The idea', value: project.problem },
            { label: 'The build', value: project.built },
            { label: 'The result', value: project.outcome }
        ]
    }
}))
