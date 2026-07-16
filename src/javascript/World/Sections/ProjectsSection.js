import * as THREE from 'three'
import Project from './Project'
import gsap from 'gsap'

export default class ProjectsSection
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.resources = _options.resources
        this.camera = _options.camera
        this.passes = _options.passes
        this.objects = _options.objects
        this.areas = _options.areas
        this.zones = _options.zones
        this.tiles = _options.tiles
        this.debug = _options.debug
        this.x = _options.x
        this.y = _options.y

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('projects')
            this.debugFolder.open()
        }

        // Set up
        this.items = []

        this.interDistance = 24
        this.positionRandomess = 0
        this.projectHalfWidth = 9

        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false
        this.container.updateMatrix()

        this.setGeometries()
        this.setMeshes()
        this.setList()
        this.setZone()

        // Add all project from the list
        for(const _options of this.list)
        {
            this.add(_options)
        }
    }

    setGeometries()
    {
        this.geometries = {}
        this.geometries.floor = new THREE.PlaneGeometry(16, 8)
    }

    setMeshes()
    {
        this.meshes = {}

        // this.meshes.boardStructure = this.objects.getConvertedMesh(this.resources.items.projectsBoardStructure.scene.children, { floorShadowTexture: this.resources.items.projectsBoardStructureFloorShadowTexture })
        this.resources.items.areaOpenTexture.magFilter = THREE.NearestFilter
        this.resources.items.areaOpenTexture.minFilter = THREE.LinearFilter
        this.meshes.boardPlane = this.resources.items.projectsBoardPlane.scene.children[0]
        this.meshes.areaLabel = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, color: 0xffffff, alphaMap: this.resources.items.areaOpenTexture }))
        this.meshes.areaLabel.matrixAutoUpdate = false
    }

    setList()
    {
        this.list = [
            {
                name: 'Zoan Collective',
                imageSources:
                [
                    './models/projects/zoan/slide-a.svg',
                    './models/projects/zoan/slide-b.svg',
                    './models/projects/zoan/slide-c.svg'
                ],
                floorTexture: null,
                link:
                {
                    href: 'https://zoancollective.site',
                    x: - 4.8,
                    y: - 3,
                    halfExtents:
                    {
                        x: 3.2,
                        y: 1.5
                    }
                },
                details:
                {
                    eyebrow: 'Design studio',
                    role: 'Founder + design operator',
                    problem: 'Founders and teams need design that de-risks investment, not just decks — clarity investors trust and users love.',
                    built: 'A boutique studio shipping brand and product design grounded in the seven principles of Zen design.',
                    stack: 'Brand identity, product design, design systems, creative direction',
                    outcome: 'A trusted design partner that turns clarity into funded products and measurable business outcomes.'
                },
                theme:
                {
                    accent: '#b8e986',
                    secondary: '#f2cc94',
                    floor: '#52654a',
                    matcap: '#dcecc9',
                    indirect: '#6f8f4e',
                    glow: '#b8e986'
                },
                prototype:
                {
                    type: 'principles',
                    prompt: 'Tune the product direction',
                    options: [
                        { label: 'Clarity', value: 'One decisive action, obvious hierarchy, zero decorative noise.' },
                        { label: 'Restraint', value: 'Remove until the remaining details carry real meaning.' },
                        { label: 'Rhythm', value: 'Use pacing and repetition to make complex flows feel natural.' }
                    ]
                },
                story:
                [
                    {
                        kicker: 'The spark',
                        title: 'Design was being treated as decoration',
                        copy: 'I kept watching strong founders lose fundable ideas: polished decks in front of confusing products. The pitch and the product were telling two different stories — and investors could feel it.',
                        supporting: 'Founder + design operator'
                    },
                    {
                        kicker: 'The stakes',
                        title: 'Investors fund clarity. Users reward it.',
                        copy: 'Design had to de-risk the investment, not dress it up. That means a product whose value is obvious in the first thirty seconds — to the person writing the check and the person clicking the button.',
                        supporting: 'Brand identity · product design · creative direction'
                    },
                    {
                        kicker: 'The build',
                        title: 'A studio grounded in seven principles of Zen design',
                        copy: 'Zoan ships brand and product design where every element earns its place: austere where it should be quiet, bold where the story turns. Design systems that keep that discipline long after the engagement ends.',
                        supporting: 'Design systems built to outlive the engagement'
                    },
                    {
                        kicker: 'The outcome',
                        title: 'Clarity became the deliverable',
                        copy: 'Zoan is now a trusted partner for founders who need their product to make the argument for them — turning clarity into funded products and measurable business outcomes.',
                        supporting: 'zoancollective.site'
                    }
                ]
            },
            {
                name: 'Lucid',
                imageSources:
                [
                    './models/projects/lucid/slide-a.svg',
                    './models/projects/lucid/slide-b.svg',
                    './models/projects/lucid/slide-c.svg'
                ],
                floorTexture: null,
                link:
                {
                    href: 'https://www.lucid-app.xyz/',
                    x: - 4.8,
                    y: - 3,
                    halfExtents:
                    {
                        x: 3.2,
                        y: 1.5
                    }
                },
                details:
                {
                    eyebrow: 'AI audio product',
                    role: 'Product design + full-stack build',
                    problem: 'People need a fast way to shift into sleep, focus, or reset states without building playlists from scratch.',
                    built: 'A web app for binaural beats and personalized AI-generated soundscapes.',
                    stack: 'Responsive web app, audio-first UX, AI soundscape generation',
                    outcome: 'A focused wellness product with a direct, calming path from intent to listening.'
                },
                theme:
                {
                    accent: '#7ee8fa',
                    secondary: '#a78bfa',
                    floor: '#283d67',
                    matcap: '#b9d9ff',
                    indirect: '#4f67b6',
                    glow: '#6dd5ed'
                },
                prototype:
                {
                    type: 'soundscape',
                    prompt: 'Choose a listening state',
                    options: [
                        { label: 'Focus', value: 'Layered pulse · 40 Hz', tone: 'focus' },
                        { label: 'Reset', value: 'Breathing space · 8 Hz', tone: 'reset' },
                        { label: 'Sleep', value: 'Low drift · 3 Hz', tone: 'sleep' }
                    ]
                },
                story:
                [
                    {
                        kicker: 'The spark',
                        title: 'Everyone already self-medicates with sound',
                        copy: 'Rain videos to fall asleep. Lo-fi loops to focus. People instinctively reach for audio to change how they feel — then spend twenty minutes hunting for the right track instead of feeling it.',
                        supporting: 'Product design + full-stack build'
                    },
                    {
                        kicker: 'The stakes',
                        title: 'The tool should disappear before you do',
                        copy: 'A sleep product that makes you browse is a contradiction. The entire experience had to collapse into one decision — how do you want to feel? — with sound following seconds later.',
                        supporting: 'Audio-first UX · intent over library'
                    },
                    {
                        kicker: 'The build',
                        title: 'Binaural science, generative soundscapes',
                        copy: 'Lucid pairs tuned binaural beats with AI-generated soundscapes that adapt to the state you choose — sleep, focus, or reset. No playlists, no accounts standing between intent and listening.',
                        supporting: 'Responsive web app · AI soundscape generation'
                    },
                    {
                        kicker: 'The outcome',
                        title: 'From intent to listening in seconds',
                        copy: 'A focused wellness product with a direct, calming path from how you want to feel to the sound that gets you there — the tool disappears, the state remains.',
                        supporting: 'lucid-app.xyz'
                    }
                ]
            },
            {
                name: 'FocusFi',
                imageSources:
                [
                    './models/projects/focusfi/slide-a.svg',
                    './models/projects/focusfi/slide-b.svg',
                    './models/projects/focusfi/slide-c.svg'
                ],
                floorTexture: null,
                link:
                {
                    href: 'https://www.focusfi.app/',
                    x: - 4.8,
                    y: - 3,
                    halfExtents:
                    {
                        x: 3.2,
                        y: 1.5
                    }
                },
                details:
                {
                    eyebrow: 'AI study platform',
                    role: 'Product design + full-stack build',
                    problem: 'Students need study tools that turn material into practice and keep them accountable.',
                    built: 'A focus app with instant AI flashcards, gamified stakes, and real-time ghost study sessions.',
                    stack: 'Responsive web app, AI flashcards, gamified study loops, real-time study sessions',
                    outcome: 'A more active study workflow built around practice, accountability, and momentum.'
                },
                theme:
                {
                    accent: '#ff9f7a',
                    secondary: '#ffd166',
                    floor: '#613c5d',
                    matcap: '#ffd6ca',
                    indirect: '#b65a76',
                    glow: '#ff8f70'
                },
                prototype:
                {
                    type: 'flashcards',
                    prompt: 'Try an active-recall loop',
                    options: [
                        { label: 'Question', value: 'What makes retrieval practice more effective than rereading?' },
                        { label: 'Reveal', value: 'It strengthens the path used to recall information, exposing what still needs work.' },
                        { label: 'Commit', value: 'Confidence logged. The next review adapts to this answer.' }
                    ]
                },
                story:
                [
                    {
                        kicker: 'The spark',
                        title: 'Rereading feels like studying. It isn’t.',
                        copy: 'Students highlight, reread, and feel productive — then blank in the exam. The science is unambiguous: memory is built by retrieval, not review. Almost no study tool is honest about that.',
                        supporting: 'Product design + full-stack build'
                    },
                    {
                        kicker: 'The stakes',
                        title: 'Practice needs pressure to stick',
                        copy: 'Knowing the right method isn’t enough — students abandon flashcard apps within a week. The real problem is accountability: something has to be on the line, and someone has to be watching.',
                        supporting: 'Behavior design · motivation loops'
                    },
                    {
                        kicker: 'The build',
                        title: 'Flashcards with stakes, sessions with ghosts',
                        copy: 'FocusFi turns any material into AI-generated flashcards in seconds, puts gamified stakes on completing them, and runs real-time ghost study sessions so you’re never grinding alone.',
                        supporting: 'AI flashcards · gamified stakes · live sessions'
                    },
                    {
                        kicker: 'The outcome',
                        title: 'Studying that behaves like training',
                        copy: 'A study workflow built around practice, accountability, and momentum — where every session ends with proof of what you know, not just time spent looking at it.',
                        supporting: 'focusfi.app'
                    }
                ]
            }
        ]
    }

    setZone()
    {
        const totalWidth = this.list.length * (this.interDistance / 2)

        const zone = this.zones.add({
            position: { x: this.x + totalWidth - this.projectHalfWidth - 6, y: this.y },
            halfExtents: { x: totalWidth, y: 12 },
            data: { cameraAngle: 'projects' }
        })

        zone.on('in', (_data) =>
        {
            this.camera.angle.set(_data.cameraAngle)
            gsap.to(this.passes.horizontalBlurPass.material.uniforms.uStrength.value, { x: 0, duration: 2 })
            gsap.to(this.passes.verticalBlurPass.material.uniforms.uStrength.value, { y: 0, duration: 2 })
        })

        zone.on('out', () =>
        {
            this.camera.angle.set('default')
            gsap.to(this.passes.horizontalBlurPass.material.uniforms.uStrength.value, { x: this.passes.horizontalBlurPass.strength, duration: 2 })
            gsap.to(this.passes.verticalBlurPass.material.uniforms.uStrength.value, { y: this.passes.verticalBlurPass.strength, duration: 2 })
        })
    }

    add(_options)
    {
        const x = this.x + this.items.length * this.interDistance
        let y = this.y
        if(this.items.length > 0)
        {
            y += (Math.random() - 0.5) * this.positionRandomess
        }

        // Create project
        const project = new Project({
            time: this.time,
            resources: this.resources,
            objects: this.objects,
            areas: this.areas,
            geometries: this.geometries,
            meshes: this.meshes,
            debug: this.debugFolder,
            x: x,
            y: y,
            ..._options
        })

        this.container.add(project.container)

        project.zone = this.zones.add({
            position: { x: project.x, y: project.y },
            halfExtents: { x: 10.5, y: 10 },
            data: { project }
        })

        // Add tiles
        if(this.items.length >= 1)
        {
            const previousProject = this.items[this.items.length - 1]
            const start = new THREE.Vector2(previousProject.x + this.projectHalfWidth, previousProject.y)
            const end = new THREE.Vector2(project.x - this.projectHalfWidth, project.y)
            const delta = end.clone().sub(start)
            this.tiles.add({
                start: start,
                delta: delta
            })
        }

        // Save
        this.items.push(project)
    }
}
