import gsap from 'gsap'

export default class ExperienceDirector
{
    constructor(_options)
    {
        this.config = _options.config
        this.time = _options.time
        this.camera = _options.camera
        this.physics = _options.physics
        this.controls = _options.controls
        this.sounds = _options.sounds
        this.dayNightCycle = _options.dayNightCycle
        this.visitGhost = _options.visitGhost
        this.diagnostics = _options.diagnostics
        this.projects = _options.projects || []

        this.locks = new Set()
        this.activeProjectZone = null
        this.toastTimeout = null
        this.replayLastUpdateAt = 0
        this.replayZoomBeforeWatch = null

        this.portal = {
            project: null,
            slideIndex: 0,
            cinematic: false,
            cinematicStage: 0,
            cinematicEnded: false,
            cinematicTimer: null
        }
        this.actNumerals = ['I', 'II', 'III', 'IV', 'V']
        this.setElements()
        this.bindProjects()
        this.bindEvents()

        this.time.on('tick', () => this.update())

        this.diagnostics.on('change.experience', (_state) => this.updateXrayButton(_state.enabled))
    }

    setElements()
    {
        this.$root = document.createElement('div')
        this.$root.className = 'experience-director'
        this.$root.innerHTML = `
            <nav class="experience-tools" aria-label="Experience tools">
                <button type="button" data-experience-action="xray" aria-pressed="false">
                    <span>X</span> System X-ray
                </button>
                <button type="button" data-experience-action="replay" aria-expanded="false">
                    <span>R</span> Replay
                </button>
            </nav>

            <section class="replay-console" aria-label="Previous visit replay" hidden>
                <div class="replay-console__heading">
                    <div><span>Previous visit</span><strong class="js-replay-status">Checking replay…</strong></div>
                    <button type="button" data-replay-action="close">Close</button>
                </div>
                <div class="replay-console__progress"><span class="js-replay-progress"></span></div>
                <p class="js-replay-meta">No stored route yet. Drive for at least ten seconds and return later.</p>
                <div class="replay-console__actions">
                    <button type="button" data-replay-action="play">Pause</button>
                    <button type="button" data-replay-action="restart">Restart</button>
                    <button type="button" data-replay-action="watch" aria-pressed="false">Watch camera</button>
                    <button type="button" data-replay-action="share">Copy route</button>
                </div>
                <div class="replay-console__speeds" aria-label="Replay speed">
                    <button type="button" data-replay-speed="0.5">½×</button>
                    <button type="button" data-replay-speed="1" class="is-active">1×</button>
                    <button type="button" data-replay-speed="2">2×</button>
                </div>
            </section>

            <div class="world-toast" role="status" aria-live="polite" hidden></div>
        `
        document.body.appendChild(this.$root)

        this.$portal = document.createElement('dialog')
        this.$portal.className = 'project-portal'
        this.$portal.setAttribute('aria-labelledby', 'project-portal-title')
        this.$portal.innerHTML = `
            <div class="project-portal__accent"></div>
            <header class="project-portal__header">
                <div>
                    <p class="project-portal__context js-portal-context">Interactive case study</p>
                    <h1 id="project-portal-title" class="js-portal-project">Project</h1>
                </div>
                <button class="project-portal__close" type="button" data-portal-action="close">Close</button>
            </header>
            <div class="project-portal__body">
                <figure class="project-portal__visual">
                    <img class="js-portal-image" alt="" />
                    <figcaption class="js-portal-caption">Project interface</figcaption>
                    <div class="project-portal__slides js-portal-slides" aria-label="Project slides"></div>
                </figure>
                <article class="project-portal__story">
                    <p class="project-portal__kicker js-portal-kicker">The problem</p>
                    <h2 class="js-portal-title"></h2>
                    <p class="project-portal__lead js-portal-copy"></p>
                    <dl class="project-portal__facts">
                        <div><dt>Role</dt><dd class="js-portal-role"></dd></div>
                        <div><dt>System</dt><dd class="js-portal-stack"></dd></div>
                    </dl>
                    <div class="project-portal__cinematic-progress js-cinematic-progress" aria-hidden="true"></div>
                </article>
            </div>
            <section class="project-prototype" aria-labelledby="project-prototype-title">
                <div>
                    <p>Playable proof</p>
                    <h2 id="project-prototype-title" class="js-prototype-prompt">Try the product idea</h2>
                </div>
                <div class="project-prototype__interaction">
                    <div class="project-prototype__options js-prototype-options"></div>
                    <output class="project-prototype__output js-prototype-output"></output>
                </div>
            </section>
            <footer class="project-portal__footer">
                <div>
                    <button type="button" data-portal-action="previous">← Previous</button>
                    <button type="button" data-portal-action="next">Next →</button>
                </div>
                <div>
                    <button type="button" data-portal-action="cinematic" class="project-portal__cinematic">Play cinematic story</button>
                    <a class="js-portal-live" href="#" target="_blank" rel="noopener">Open live project ↗</a>
                </div>
            </footer>
        `
        document.body.appendChild(this.$portal)

        this.$tools = this.$root.querySelector('.experience-tools')
        this.$xrayButton = this.$root.querySelector('[data-experience-action="xray"]')
        this.$replayButton = this.$root.querySelector('[data-experience-action="replay"]')
        this.$replay = this.$root.querySelector('.replay-console')
        this.$replayStatus = this.$root.querySelector('.js-replay-status')
        this.$replayProgress = this.$root.querySelector('.js-replay-progress')
        this.$replayMeta = this.$root.querySelector('.js-replay-meta')
        this.$toast = this.$root.querySelector('.world-toast')

        this.$portalProject = this.$portal.querySelector('.js-portal-project')
        this.$portalContext = this.$portal.querySelector('.js-portal-context')
        this.$portalImage = this.$portal.querySelector('.js-portal-image')
        this.$portalCaption = this.$portal.querySelector('.js-portal-caption')
        this.$portalSlides = this.$portal.querySelector('.js-portal-slides')
        this.$portalKicker = this.$portal.querySelector('.js-portal-kicker')
        this.$portalTitle = this.$portal.querySelector('.js-portal-title')
        this.$portalCopy = this.$portal.querySelector('.js-portal-copy')
        this.$portalRole = this.$portal.querySelector('.js-portal-role')
        this.$portalStack = this.$portal.querySelector('.js-portal-stack')
        this.$cinematicProgress = this.$portal.querySelector('.js-cinematic-progress')
        this.$prototypePrompt = this.$portal.querySelector('.js-prototype-prompt')
        this.$prototypeOptions = this.$portal.querySelector('.js-prototype-options')
        this.$prototypeOutput = this.$portal.querySelector('.js-prototype-output')
        this.$portalLive = this.$portal.querySelector('.js-portal-live')
        this.$cinematicButton = this.$portal.querySelector('[data-portal-action="cinematic"]')
        this.$portalStory = this.$portal.querySelector('.project-portal__story')
        this.$portalVisual = this.$portal.querySelector('.project-portal__visual')
        this.$portalPrevious = this.$portal.querySelector('[data-portal-action="previous"]')
        this.$portalNext = this.$portal.querySelector('[data-portal-action="next"]')
    }

    bindProjects()
    {
        for(const project of this.projects)
        {
            project.setPortalHandler((_project) => this.openPortal(_project))

            if(project.zone)
            {
                project.zone.on('in.experience', () =>
                {
                    this.activeProjectZone = project
                    this.activateProjectTheme(project)
                })
                project.zone.on('out.experience', () =>
                {
                    if(this.activeProjectZone === project)
                    {
                        this.activeProjectZone = null
                    }
                    if(this.portal.project !== project)
                    {
                        this.clearProjectTheme()
                    }
                })
            }
        }
    }

    bindEvents()
    {
        this.$tools.addEventListener('click', (_event) =>
        {
            const button = _event.target.closest('[data-experience-action]')
            if(!button) return

            if(button.dataset.experienceAction === 'xray') this.diagnostics.toggle()
            if(button.dataset.experienceAction === 'replay') this.toggleReplayPanel()
        })

        this.$portal.addEventListener('click', (_event) =>
        {
            const action = _event.target.closest('[data-portal-action]')?.dataset.portalAction
            if(action === 'close') this.closePortal()
            if(action === 'previous') this.changeSlide(-1)
            if(action === 'next') this.changeSlide(1)
            if(action === 'cinematic') this.toggleCinematic()

            const slide = _event.target.closest('[data-portal-slide]')
            if(slide)
            {
                this.portal.slideIndex = Number(slide.dataset.portalSlide)
                this.renderProject()
            }

            const prototypeOption = _event.target.closest('[data-prototype-option]')
            if(prototypeOption)
            {
                this.selectPrototypeOption(Number(prototypeOption.dataset.prototypeOption))
            }
        })

        this.$portal.addEventListener('cancel', (_event) =>
        {
            _event.preventDefault()
            this.closePortal()
        })

        this.$root.addEventListener('click', (_event) =>
        {
            const replayAction = _event.target.closest('[data-replay-action]')?.dataset.replayAction
            if(replayAction) this.handleReplayAction(replayAction)

            const replaySpeed = _event.target.closest('[data-replay-speed]')
            if(replaySpeed)
            {
                this.visitGhost.setPlaybackSpeed(Number(replaySpeed.dataset.replaySpeed))
                this.updateReplayPanel(true)
            }

        })
    }

    activateProjectTheme(_project)
    {
        if(!_project) return

        this.dayNightCycle.setExperienceTheme(_project.theme)
        document.documentElement.style.setProperty('--experience-accent', _project.theme.accent || '#8ed4ff')
        document.documentElement.style.setProperty('--experience-secondary', _project.theme.secondary || '#f2cc94')
        document.body.dataset.projectTheme = _project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    }

    clearProjectTheme()
    {
        this.dayNightCycle.clearExperienceTheme()
        document.documentElement.style.removeProperty('--experience-accent')
        document.documentElement.style.removeProperty('--experience-secondary')
        delete document.body.dataset.projectTheme
    }

    openPortal(_project, _options = {})
    {
        if(!_project) return

        this.stopCinematic()
        this.portal.project = _project
        this.portal.slideIndex = 0
        this.activateProjectTheme(_project)
        this.renderProject()
        this.setInteractionLock('portal', true)

        if(!this.$portal.open)
        {
            this.$portal.showModal()
        }
        document.body.classList.add('has-project-portal')

        if(_options.cinematic)
        {
            this.startCinematic()
        }
    }

    closePortal()
    {
        this.stopCinematic()
        if(this.$portal.open)
        {
            this.$portal.close()
        }
        document.body.classList.remove('has-project-portal')
        this.setInteractionLock('portal', false)

        const project = this.portal.project
        this.portal.project = null
        if(!project || !project.zone?.isIn)
        {
            this.clearProjectTheme()
        }
    }

    getCinematicScenes(_project)
    {
        // Each project ships its own four-act script; fall back to a generic
        // three-act cut built from the case-study details
        if(_project.story && _project.story.length)
        {
            return _project.story
        }

        return [
            {
                kicker: 'The problem',
                title: 'A real user tension worth solving',
                copy: _project.details.problem,
                supporting: _project.details.role
            },
            {
                kicker: 'The build',
                title: 'The product decision became the system',
                copy: _project.details.built,
                supporting: _project.details.stack
            },
            {
                kicker: 'The outcome',
                title: 'Designed to create momentum after launch',
                copy: _project.details.outcome,
                supporting: 'Product thinking, interaction craft, and implementation working together'
            }
        ]
    }

    getSceneDuration()
    {
        return this.config.reducedMotion ? 4600 : 6800
    }

    renderProject()
    {
        const project = this.portal.project
        if(!project) return

        const images = project.imageSources || []
        const slideIndex = Math.min(Math.max(this.portal.slideIndex, 0), Math.max(images.length - 1, 0))
        const scenes = this.getCinematicScenes(project)
        const stage = Math.min(this.portal.cinematicStage, scenes.length - 1)
        const scene = this.portal.cinematic ? scenes[stage] : null
        const actLabel = scene ? `Act ${this.actNumerals[stage] || stage + 1} · ${scene.kicker}` : null

        this.$portal.style.setProperty('--project-accent', project.theme.accent || '#8ed4ff')
        this.$portal.style.setProperty('--project-secondary', project.theme.secondary || '#f2cc94')
        this.$portalProject.textContent = project.name

        if(this.portal.cinematic)
        {
            this.$portalContext.textContent = this.portal.cinematicEnded
                ? `${project.name} · the full story`
                : `A ${project.name} story · Act ${this.actNumerals[stage] || stage + 1} of ${scenes.length}`
        }
        else
        {
            this.$portalContext.textContent = project.details.eyebrow
        }

        this.$portalImage.src = images[this.portal.cinematic ? stage % Math.max(images.length, 1) : slideIndex] || ''
        this.$portalImage.alt = `${project.name} interface, view ${(this.portal.cinematic ? stage : slideIndex) + 1}`
        this.$portalCaption.textContent = this.portal.cinematic ? actLabel : `${project.name} · interface ${slideIndex + 1}`

        this.$portalKicker.textContent = scene ? actLabel : 'The short version'
        this.$portalTitle.textContent = scene ? scene.title : project.details.problem
        this.$portalCopy.textContent = scene ? scene.copy : project.details.built
        this.$portalRole.textContent = project.details.role
        this.$portalStack.textContent = scene ? scene.supporting : project.details.stack
        this.$portalLive.href = project.link.href

        this.$portalSlides.innerHTML = images.map((_image, _index) => `
            <button type="button" data-portal-slide="${_index}" class="${_index === slideIndex ? 'is-active' : ''}" aria-label="View project image ${_index + 1}"></button>
        `).join('')

        // Story-style timed progress: past acts are filled, the live act animates
        this.$cinematicProgress.innerHTML = scenes.map((_scene, _index) =>
        {
            let state = ''
            if(this.portal.cinematic)
            {
                if(this.portal.cinematicEnded || _index < stage) state = 'is-done'
                else if(_index === stage) state = 'is-live'
            }
            return `<span class="${state}" style="--scene-duration: ${this.getSceneDuration()}ms"></span>`
        }).join('')

        // Footer buttons step through acts while the story plays
        this.$portalPrevious.textContent = this.portal.cinematic ? '‹ Previous act' : '← Previous'
        this.$portalNext.textContent = this.portal.cinematic ? 'Next act ›' : 'Next →'

        this.$portal.classList.toggle('is-cinematic', this.portal.cinematic)
        this.$portal.classList.toggle('is-story-ended', this.portal.cinematicEnded)

        if(this.portal.cinematicEnded) this.$cinematicButton.textContent = 'Replay the story ↺'
        else if(this.portal.cinematic) this.$cinematicButton.textContent = 'Stop the story'
        else this.$cinematicButton.textContent = '▶ Play the story'

        this.renderPrototype(project)
    }

    // Re-runs the scene entrance animations (staggered text, image drift)
    triggerSceneTransition()
    {
        if(this.config.reducedMotion) return

        for(const element of [this.$portalStory, this.$portalVisual])
        {
            element.classList.remove('is-scene-enter')
            void element.offsetWidth
            element.classList.add('is-scene-enter')
        }

        this.$portalVisual.dataset.kenburns = this.portal.cinematicStage % 2
    }

    renderPrototype(_project)
    {
        const prototype = _project.prototype
        if(!prototype)
        {
            this.$prototypePrompt.textContent = 'Open the live product to explore the full system.'
            this.$prototypeOptions.innerHTML = ''
            this.$prototypeOutput.textContent = _project.details.outcome
            return
        }

        this.$prototypePrompt.textContent = prototype.prompt
        this.$prototypeOptions.innerHTML = prototype.options.map((_option, _index) => `
            <button type="button" data-prototype-option="${_index}" class="${_index === 0 ? 'is-active' : ''}">${_option.label}</button>
        `).join('')
        this.$prototypeOutput.textContent = prototype.options[0].value
        this.$prototypeOutput.dataset.prototypeType = prototype.type
    }

    selectPrototypeOption(_index)
    {
        const prototype = this.portal.project?.prototype
        const option = prototype?.options?.[_index]
        if(!option) return

        for(const button of this.$prototypeOptions.querySelectorAll('[data-prototype-option]'))
        {
            button.classList.toggle('is-active', Number(button.dataset.prototypeOption) === _index)
        }

        this.$prototypeOutput.classList.remove('is-changing')
        window.requestAnimationFrame(() =>
        {
            this.$prototypeOutput.textContent = option.value
            this.$prototypeOutput.classList.add('is-changing')
        })

        if(prototype.type === 'soundscape')
        {
            this.sounds.playInterfaceTone(option.tone)
        }
    }

    changeSlide(_direction)
    {
        if(!this.portal.project) return

        // While the story plays, previous/next step between acts
        if(this.portal.cinematic)
        {
            const scenes = this.getCinematicScenes(this.portal.project)
            const nextStage = Math.min(Math.max(this.portal.cinematicStage + _direction, 0), scenes.length - 1)
            if(nextStage === this.portal.cinematicStage) return

            this.portal.cinematicStage = nextStage
            this.portal.cinematicEnded = false
            this.renderProject()
            this.triggerSceneTransition()
            this.scheduleCinematicAdvance()
            return
        }

        const count = this.portal.project.imageSources.length
        this.portal.slideIndex = (this.portal.slideIndex + _direction + count) % count
        this.renderProject()
    }

    toggleCinematic()
    {
        if(this.portal.cinematicEnded) this.startCinematic()
        else if(this.portal.cinematic) this.stopCinematic()
        else this.startCinematic()
    }

    startCinematic()
    {
        if(!this.portal.project) return

        this.stopCinematic()
        this.portal.cinematic = true
        this.portal.cinematicEnded = false
        this.portal.cinematicStage = 0
        this.renderProject()
        this.triggerSceneTransition()
        this.scheduleCinematicAdvance()
    }

    scheduleCinematicAdvance()
    {
        window.clearTimeout(this.portal.cinematicTimer)
        this.portal.cinematicTimer = window.setTimeout(() =>
        {
            if(!this.portal.cinematic || this.portal.cinematicEnded) return

            const scenes = this.getCinematicScenes(this.portal.project)
            if(this.portal.cinematicStage < scenes.length - 1)
            {
                this.portal.cinematicStage++
                this.renderProject()
                this.triggerSceneTransition()
                this.scheduleCinematicAdvance()
            }
            else
            {
                this.finishCinematic()
            }
        }, this.getSceneDuration())
    }

    // The story stays on its closing act with a replay offer instead of
    // snapping back to the plain portal
    finishCinematic()
    {
        window.clearTimeout(this.portal.cinematicTimer)
        this.portal.cinematicTimer = null
        this.portal.cinematicEnded = true
        this.renderProject()
    }

    stopCinematic()
    {
        window.clearTimeout(this.portal.cinematicTimer)
        this.portal.cinematicTimer = null
        const wasCinematic = this.portal.cinematic
        this.portal.cinematic = false
        this.portal.cinematicEnded = false
        this.portal.cinematicStage = 0
        if(wasCinematic && this.portal.project)
        {
            this.renderProject()
        }
    }

    toggleReplayPanel()
    {
        const willOpen = this.$replay.hidden
        this.$replay.hidden = !willOpen
        this.$replayButton.setAttribute('aria-expanded', `${willOpen}`)
        if(willOpen) this.updateReplayPanel(true)
    }

    async handleReplayAction(_action)
    {
        const status = this.visitGhost.getStatus()

        if(_action === 'close')
        {
            if(status.watching) this.setReplayWatching(false)
            this.toggleReplayPanel()
        }
        if(_action === 'play') status.playing ? this.visitGhost.pause() : this.visitGhost.play()
        if(_action === 'restart') this.visitGhost.restart()
        if(_action === 'watch') this.setReplayWatching(!status.watching)
        if(_action === 'share')
        {
            const copied = await this.visitGhost.copyShareUrl()
            this.notify(copied ? 'Replay route copied. Anyone with the link can load the ghost.' : 'A replay must be recorded before it can be shared.', copied ? 'project' : 'warning')
        }

        this.updateReplayPanel(true)
    }

    setReplayWatching(_watching)
    {
        const watching = Boolean(_watching)
        if(watching === this.visitGhost.playback.watching) return
        if(watching && !this.visitGhost.hasReplay()) return

        if(watching)
        {
            this.replayZoomBeforeWatch = this.camera.zoom.targetValue
        }

        this.visitGhost.playback.watching = watching
        this.camera.targetOverride = watching ? this.visitGhost.model.position : null
        this.camera.zoom.targetValue = watching ? 0.22 : (this.replayZoomBeforeWatch ?? 0.5)
        if(!watching) this.replayZoomBeforeWatch = null
        this.setInteractionLock('replay-watch', watching)
        document.body.classList.toggle('is-watching-replay', watching)
    }

    updateReplayPanel(_force = false)
    {
        if(this.$replay.hidden || (!_force && this.time.elapsed - this.replayLastUpdateAt < 250)) return

        const status = this.visitGhost.getStatus()
        this.replayLastUpdateAt = this.time.elapsed
        this.$replayStatus.textContent = status.available ? (status.playing ? 'Ghost running' : 'Ghost paused') : 'No replay recorded'
        this.$replayProgress.style.transform = `scaleX(${status.progress})`
        this.$replayMeta.textContent = status.available
            ? `${Math.round(status.duration / 1000)} sec · ${Math.round(status.distance)} m${status.shared ? ' · shared route' : ''}`
            : 'Drive for at least ten seconds, then return or reload to race your previous route.'

        const playButton = this.$replay.querySelector('[data-replay-action="play"]')
        const watchButton = this.$replay.querySelector('[data-replay-action="watch"]')
        playButton.textContent = status.playing ? 'Pause' : 'Play'
        playButton.disabled = !status.available
        watchButton.disabled = !status.available
        watchButton.setAttribute('aria-pressed', `${status.watching}`)

        for(const button of this.$replay.querySelectorAll('[data-replay-speed]'))
        {
            button.classList.toggle('is-active', Number(button.dataset.replaySpeed) === status.speed)
            button.disabled = !status.available
        }
    }

    updateXrayButton(_enabled)
    {
        this.$xrayButton.setAttribute('aria-pressed', `${_enabled}`)
        this.$xrayButton.classList.toggle('is-active', _enabled)
    }

    setInteractionLock(_reason, _locked)
    {
        if(_locked) this.locks.add(_reason)
        else this.locks.delete(_reason)

        const locked = this.locks.size > 0
        document.body.classList.toggle('is-experience-locked', locked)
        if(locked)
        {
            this.clearControls()
            this.camera.pan.disable()
            const body = this.physics?.car?.chassis?.body
            if(body)
            {
                body.velocity.set(0, 0, 0)
                body.angularVelocity.set(0, 0, 0)
                body.sleep()
            }
        }
        else
        {
            this.camera.pan.enable()
            this.physics?.car?.chassis?.body?.wakeUp()
        }
    }

    clearControls()
    {
        if(!this.controls?.actions) return
        for(const action in this.controls.actions)
        {
            this.controls.actions[action] = false
        }
    }

    notify(_message, _tone = 'project')
    {
        window.clearTimeout(this.toastTimeout)
        this.$toast.textContent = _message
        this.$toast.dataset.tone = _tone
        this.$toast.hidden = false
        this.$toast.classList.remove('is-visible')
        window.requestAnimationFrame(() => this.$toast.classList.add('is-visible'))
        this.toastTimeout = window.setTimeout(() =>
        {
            this.$toast.classList.remove('is-visible')
            window.setTimeout(() => { this.$toast.hidden = true }, 350)
        }, 3600)
    }

    update()
    {
        if(this.locks.size > 0)
        {
            this.clearControls()
        }
        this.updateReplayPanel()
    }
}
