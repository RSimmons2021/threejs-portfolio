import * as THREE from 'three'
import CANNON from 'cannon'
import createGhostF1 from './createGhostF1.js'
import { SPRINT_GATES, crossedGate, isInsideArcade, medalFor, readBest, writeBest } from './arcadeRules.js'

export default class Arcade
{
    constructor(world)
    {
        this.world = world
        this.container = new THREE.Group()
        this.container.name = 'After Hours Arcade'
        this.body = world.physics.car.chassis.body
        this.bowling = world.sections.playground.bowling
        try { this.storage = window.localStorage } catch { this.storage = null }
        this.best = readBest(this.storage)
        this.state = 'idle'
        this.game = 'sprint'
        this.lastTick = performance.now()
        this.setCourtyard()
        this.setInterface()
        this.setGates()
        this.ghost = createGhostF1(world.resources, new THREE.MeshBasicMaterial({ color: '#167f87', transparent: true, opacity: 0.38, depthWrite: false }))
        this.ghost.visible = false
        this.container.add(this.ghost)
        world.time.on('tick', () => this.update())
        document.addEventListener('visibilitychange', () => { if(document.hidden) this.pause() })
        window.addEventListener('blur', () => this.pause())
        window.addEventListener('portfolio:navigate', () => this.exit(false))
        window.addEventListener('resize', () => { if(this.state !== 'idle') this.setGameCamera() })
        document.addEventListener('keydown', event =>
        {
            if(this.state === 'idle' || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return
            if(['running', 'countdown'].includes(this.state) && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()
            if(event.code === 'Escape' || event.code === 'KeyR')
            {
                event.preventDefault()
                event.stopImmediatePropagation()
                if(event.code === 'Escape') this.exit()
                else if(!event.repeat) this.start(this.game)
            }
        }, true)
        document.addEventListener('keyup', event =>
        {
            if(this.state === 'idle') return
            // Controls resets the car on R keyup, not keydown. Consume both
            // edges so retry cannot be followed by an unrelated world reset.
            if(event.code === 'KeyR') { event.preventDefault(); event.stopImmediatePropagation() }
            if(event.code === 'Space' && ['running', 'countdown'].includes(this.state)) event.preventDefault()
        }, true)
        this.render()
    }

    label(title, subtitle, x, y, z, width, color = '#fff0c9', vertical = true)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 1024
        canvas.height = 256
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = color
        ctx.fillRect(0, 0, 1024, 256)
        ctx.strokeStyle = '#172334'
        ctx.lineWidth = 14
        ctx.strokeRect(7, 7, 1010, 242)
        ctx.fillStyle = '#172334'
        ctx.textAlign = 'center'
        ctx.font = '900 76px Arial, sans-serif'
        ctx.fillText(title, 512, 116, 940)
        ctx.font = 'bold 34px Arial, sans-serif'
        ctx.fillText(subtitle, 512, 197, 940)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }))
        if(vertical) mesh.rotation.x = Math.PI / 2
        mesh.position.set(x, y, z)
        this.container.add(mesh)
        return mesh
    }

    setCourtyard()
    {
        const w = this.world
        w.resources.items.arcadeCourtyard.scene.traverse(source =>
        {
            if(!source.isMesh) return
            const mesh = source.clone()
            mesh.material = w.materials.getCelMaterial(source.material.color, source.name.startsWith('cel_glass') ? 0.3 : 0)
            this.container.add(mesh)
        })
        // Simple perimeter collision only; lane graphics and checkpoint arches
        // deliberately have no collision bodies to snag the car.
        for(const [x,y,z,sx,sy,sz] of [[-43,-38.9,2.2,29,0.6,4.4],[-53,-45,0.45,0.5,11,0.9],[-39,-49,0.23,27,0.28,0.46],[-39,-41,0.23,27,0.28,0.46]])
        {
            const body = new CANNON.Body({ mass: 0 })
            body.addShape(new CANNON.Box(new CANNON.Vec3(sx/2, sy/2, sz/2)))
            body.position.set(x,y,z)
            w.physics.world.addBody(body)
        }
        const marquee = this.label('AFTER HOURS ARCADE', 'GOOD IN THE SUN. BETTER AFTER DARK.', -43, -39.6, 3.6, 21)
        marquee.scale.y = 0.5
        this.label('NEON BOWLING', '3 FRAMES / 30 PINS / ONE LITTLE F1', -40, -45, 0.055, 11, '#93d6d0', false)
        this.label('SMASH BREAK', 'JUST FOR FUN', -36, -55.5, 0.055, 7, '#e8a1bb', false)
        this.label('MIDNIGHT SPRINT', 'EIGHT GATES. ONE CITY.', -22, -34, 0.07, 6, '#ffca62', false)
        this.label('BOWL →', 'PULL IN TO PLAY', -22, -45, 0.055, 5, '#93d6d0', false)
        this.label('TURN BACK ↶', 'RETURN ON THE LOWER LANE', 151, -32, 0.065, 7, '#ffca62', false)
        this.startPads = ['sprint', 'bowling'].map((game, i) =>
        {
            const area = w.areas.add({ position: new THREE.Vector2(-22, i ? -45 : -34), halfExtents: new THREE.Vector2(3, 1.5) })
            area.on('interact', () => { if(this.state === 'idle') this.start(game) })
            return area
        })
    }

    setInterface()
    {
        this.$panel = document.createElement('section')
        this.$panel.className = 'arcade-panel'
        this.$panel.setAttribute('aria-label', 'After Hours Arcade games')
        this.$panel.innerHTML = `
            <div class="arcade-panel__eyebrow">NYC RECREATION DEPT. / FREE PLAY</div>
            <h2>After Hours Arcade<span>↗</span></h2>
            <div class="arcade-menu">
                <p>Short games. Big little victories. Open all day.</p>
                <button data-game="sprint"><strong>01 / Midnight Sprint ↗</strong><span>Eight checkpoints. Beat your ghost. Gold under 32s.</span></button>
                <button data-game="bowling"><strong>02 / Neon Bowling ↗</strong><span>Drive into the ball. Three 8-second frames. Gold: 25 pins.</span></button>
                <p class="arcade-best"></p>
                <button data-action="smash" class="arcade-small">Reset smash wall</button>
                <button data-action="dismiss" class="arcade-small">Keep exploring</button>
            </div>
            <div class="arcade-round" hidden>
                <div class="arcade-round__title"></div>
                <output class="arcade-value" aria-label="Game progress" aria-live="off"></output>
                <p class="arcade-status" role="status" aria-live="polite"></p>
                <div class="arcade-progress" aria-hidden="true"><span></span></div>
                <div class="arcade-round__actions"><button data-action="continue">Continue</button><button data-action="retry">Retry</button><button data-action="exit">Exit game</button></div>
                <small>WASD / arrows or touch controls · Space brakes · Shift boosts · R retries</small>
            </div>`
        document.body.appendChild(this.$panel)
        this.$menu = this.$panel.querySelector('.arcade-menu')
        this.$round = this.$panel.querySelector('.arcade-round')
        this.$value = this.$panel.querySelector('.arcade-value')
        this.$status = this.$panel.querySelector('.arcade-status')
        this.$continue = this.$panel.querySelector('[data-action="continue"]')
        this.$panel.addEventListener('click', event =>
        {
            const button = event.target.closest('button')
            if(!button) return
            if(button.dataset.game) this.start(button.dataset.game)
            if(button.dataset.action === 'retry') this.start(this.game)
            if(button.dataset.action === 'exit') this.exit()
            if(button.dataset.action === 'smash') this.world.sections.playground.resetBricks()
            if(button.dataset.action === 'dismiss') { this.dismissed = true; this.$panel.hidden = true }
            if(button.dataset.action === 'continue')
            {
                if(this.state === 'paused') this.beginCountdown()
                else if(this.state === 'frame-result') { this.frame++; this.prepareFrame(); this.beginCountdown() }
            }
        })
    }

    setGates()
    {
        const ink = new THREE.MeshBasicMaterial({ color: '#172334' })
        const cream = new THREE.MeshBasicMaterial({ color: '#fff0c9' })
        this.gateGroup = new THREE.Group()
        for(const y of [-2.8, 2.8])
        {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 3.5), ink)
            post.position.set(0, y, 1.75)
            this.gateGroup.add(post)
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.39, 0.5), cream)
            stripe.position.set(0, y, 1.8)
            this.gateGroup.add(stripe)
        }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), cream)
        beam.position.z = 3.5
        this.gateGroup.add(beam)
        this.gateGroup.visible = false
        this.container.add(this.gateGroup)
        this.gateMarker = this.label('GATE →', 'PASS THROUGH', 5, -29, 0.075, 4, '#ffca62', false)
        this.gateMarker.visible = false
    }

    moveCar(x, y, heading)
    {
        const w = this.world
        w.experienceDirector.setInteractionLock('arcade', false)
        w.guidedTour.clearControls()
        this.body.position.set(x, y, 0.36)
        this.body.velocity.set(0,0,0)
        this.body.angularVelocity.set(0,0,0)
        this.body.force.set(0,0,0)
        this.body.torque.set(0,0,0)
        this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0,0,1), heading)
        this.body.wakeUp()
        w.physics.car.oldPosition?.copy(this.body.position)
        w.camera.pan.reset()
        this.setGameCamera()
    }

    setGameCamera()
    {
        const w = this.world
        const portraitBowling = this.game === 'bowling' && window.innerWidth < 768
        w.camera.angle.items.arcadeBowling = new THREE.Vector3(1.6, -0.35, 1.6)
        w.camera.angle.set(portraitBowling ? 'arcadeBowling' : 'projects')
        w.camera.zoom.targetValue = this.game === 'bowling' ? portraitBowling ? 1.75 : 1.15 : 0.7
    }

    start(game)
    {
        this.releaseRound()
        const w = this.world
        this.game = game
        this.savedWeather = { autoCycle: w.weather.settings.autoCycle, state: w.weather.state }
        w.weather.settings.autoCycle = false
        w.weather.setWeather('clear')
        this.savedGuide = w.ghostCar.settings.autoTour
        w.ghostCar.settings.autoTour = false
        this.savedGhostVisibility = [w.ghostCar.container.visible, w.visitGhost.container.visible]
        w.ghostCar.container.visible = false
        w.visitGhost.container.visible = false
        this.savedCameraTarget = w.camera.targetOverride
        w.camera.targetOverride = game === 'bowling' ? new THREE.Vector3(-38, -45, 0) : null
        this.savedAreas = w.areas.items.map(area => ({ area, active: area.active }))
        this.savedAreas.forEach(({area}) => area.deactivate())
        document.body.classList.add('arcade-active')
        this.elapsed = 0
        this.gate = 0
        this.frame = 1
        this.total = 0
        this.path = []
        this.ghostIndex = 0
        this.lastSample = -1
        this.dismissed = false
        this.bestRun = false
        if(game === 'sprint') this.moveCar(-20, -29, 0)
        else this.prepareFrame()
        this.previous = { ...this.body.position }
        this.beginCountdown()
        this.$panel.querySelector('[data-action="exit"]').focus({ preventScroll: true })
    }

    prepareFrame()
    {
        this.bowling.reset()
        this.knocked = new Set()
        this.frameTime = 0
        this.moveCar(-24.5, -45, Math.PI)
    }

    beginCountdown()
    {
        this.state = 'countdown'
        this.countdown = 3
        this.lastTick = performance.now()
        this.world.experienceDirector.setInteractionLock('arcade', true)
        this.render()
    }

    pause()
    {
        if(!['running', 'countdown'].includes(this.state)) return
        this.state = 'paused'
        this.world.experienceDirector.setInteractionLock('arcade', true)
        this.render()
    }

    releaseRound()
    {
        const w = this.world
        w.experienceDirector.setInteractionLock('arcade', false)
        if(this.savedWeather)
        {
            w.weather.settings.autoCycle = this.savedWeather.autoCycle
            w.weather.setWeather(this.savedWeather.state)
            this.savedWeather = null
        }
        if(this.savedGuide !== undefined) { w.ghostCar.settings.autoTour = this.savedGuide; this.savedGuide = undefined }
        if(this.savedGhostVisibility)
        {
            w.ghostCar.container.visible = this.savedGhostVisibility[0]
            w.visitGhost.container.visible = this.savedGhostVisibility[1]
            this.savedGhostVisibility = null
        }
        if(this.savedCameraTarget !== undefined) { w.camera.targetOverride = this.savedCameraTarget; this.savedCameraTarget = undefined }
        this.savedAreas?.forEach(({area, active}) => { if(active) area.activate() })
        this.savedAreas = null
        this.ghost.visible = false
        this.gateGroup.visible = false
        this.gateMarker.visible = false
        document.body.classList.remove('arcade-active')
    }

    exit(returnToCourtyard = true)
    {
        if(this.state === 'idle') { this.$panel.hidden = true; return }
        this.releaseRound()
        this.state = 'idle'
        this.bowling.reset()
        if(returnToCourtyard) this.moveCar(-22, -43, Math.PI)
        this.render()
    }

    finish(success = true)
    {
        this.success = success
        const score = this.game === 'sprint' ? this.elapsed : this.total
        if(success)
        {
            this.bestRun = this.game === 'sprint' ? !this.best.sprint || score < this.best.sprint : score > this.best.bowling
            if(this.bestRun)
            {
                this.best[this.game] = score
                if(this.game === 'sprint') this.best.ghost = this.path
                this.persisted = writeBest(this.storage, this.best)
            }
        }
        this.state = 'results'
        this.ghost.visible = false
        this.gateGroup.visible = false
        this.gateMarker.visible = false
        this.world.experienceDirector.setInteractionLock('arcade', true)
        this.render()
        this.$panel.querySelector('[data-action="retry"]').focus({ preventScroll: true })
    }

    updateGhost()
    {
        const path = this.best.ghost
        if(path.length < 2 || this.elapsed > path[path.length - 1][0]) { this.ghost.visible = false; return }
        while(this.ghostIndex < path.length - 2 && path[this.ghostIndex + 1][0] < this.elapsed) this.ghostIndex++
        const a = path[this.ghostIndex], b = path[this.ghostIndex + 1]
        const t = THREE.MathUtils.clamp((this.elapsed - a[0]) / Math.max(0.001, b[0] - a[0]), 0, 1)
        this.ghost.visible = true
        this.ghost.position.set(THREE.MathUtils.lerp(a[1],b[1],t),THREE.MathUtils.lerp(a[2],b[2],t),THREE.MathUtils.lerp(a[3],b[3],t)-0.27)
        this.ghost.rotation.z = a[4] + Math.atan2(Math.sin(b[4]-a[4]),Math.cos(b[4]-a[4])) * t
    }

    update()
    {
        const now = performance.now()
        const dt = Math.min((now - this.lastTick) / 1000, 0.25)
        this.lastTick = now
        if(this.state === 'idle')
        {
            const inArcade = isInsideArcade(this.body.position)
            if(!inArcade) this.dismissed = false
            this.$panel.hidden = !(inArcade && !this.dismissed)
            return
        }
        if(this.state === 'countdown')
        {
            this.countdown -= dt
            if(this.countdown <= 0)
            {
                this.state = 'running'
                this.world.experienceDirector.setInteractionLock('arcade', false)
                this.previous = { ...this.body.position }
            }
        }
        else if(this.state === 'running')
        {
            this.elapsed += dt
            if(this.game === 'sprint')
            {
                const gate = SPRINT_GATES[this.gate]
                if(crossedGate(this.previous, this.body.position, gate)) this.gate++
                this.previous = { ...this.body.position }
                if(this.elapsed - this.lastSample >= 0.1 && this.path.length < 1000)
                {
                    const p = this.body.position
                    this.path.push([this.elapsed, p.x, p.y, p.z, this.world.physics.car.angle])
                    this.lastSample = this.elapsed
                }
                this.updateGhost()
                if(this.gate === SPRINT_GATES.length) { this.finish(); return }
                if(this.elapsed >= 75 || Math.abs(this.body.position.y + 32) > 18 || this.body.position.z < -2) { this.finish(false); return }
            }
            else
            {
                this.frameTime += dt
                for(const [i, pin] of this.bowling.pins.items.entries())
                {
                    const body = pin.collision.body
                    const q = body.quaternion
                    const origin = pin.collision.origin.position
                    const dx = body.position.x - origin.x
                    const dy = body.position.y - origin.y
                    // A visible lean counts; players do not need to flatten every pin.
                    if(1 - 2 * (q.x * q.x + q.y * q.y) < 0.9 || dx * dx + dy * dy > 0.1225) this.knocked.add(i)
                }
                if(this.frameTime >= 8 || this.knocked.size === 10 && this.frameTime > 2)
                {
                    this.total += this.knocked.size
                    if(this.frame === 3) { this.finish(); return }
                    this.state = 'frame-result'
                    this.world.experienceDirector.setInteractionLock('arcade', true)
                    this.render()
                    this.$continue.focus({ preventScroll: true })
                }
            }
        }
        if(now - (this.lastRender || 0) > 100) { this.render(); this.lastRender = now }
    }

    render()
    {
        const idle = this.state === 'idle'
        this.$panel.hidden = idle ? !(isInsideArcade(this.body.position) && !this.dismissed) : false
        this.$menu.hidden = !idle
        this.$round.hidden = idle
        this.$panel.querySelector('.arcade-best').textContent = `LOCAL BESTS / Sprint: ${this.best.sprint ? this.best.sprint.toFixed(2) + 's' : 'set the first time'} · Bowling: ${this.best.bowling}/30`
        if(idle) return
        const sprint = this.game === 'sprint'
        this.$panel.querySelector('.arcade-round__title').textContent = sprint ? '01 / MIDNIGHT SPRINT' : `02 / NEON BOWLING · FRAME ${this.frame}/3`
        let value, status
        this.$continue.hidden = !['paused', 'frame-result'].includes(this.state)
        this.$continue.textContent = this.state === 'paused' ? 'Resume' : 'Next frame →'
        if(this.state === 'countdown')
        {
            value = `${Math.max(1, Math.ceil(this.countdown))}`
            status = `${value}… ` + (sprint ? 'Follow the gates east. Space brakes for the turn.' : 'Accelerate into the ball. Aim down the teal lane.')
        }
        else if(this.state === 'paused') { value = 'PAUSED'; status = 'Your round is safe. Resume when ready.' }
        else if(this.state === 'results')
        {
            value = this.success ? sprint ? `${this.elapsed.toFixed(2)}s` : `${this.total}/30` : 'TRY AGAIN'
            status = this.success ? `${medalFor(this.game, sprint ? this.elapsed : this.total)}${this.bestRun ? ' / PERSONAL BEST' : ''}${this.bestRun && !this.persisted ? ' · saved for this session only' : ''}` : 'Round ended. Stay on the avenue and pass every gate in order.'
        }
        else if(this.state === 'frame-result') { value = this.knocked.size === 10 ? 'STRIKE!' : `${this.knocked.size}/10`; status = `Frame complete · ${this.total} pins so far. Ready for the next rack?` }
        else
        {
            value = sprint ? `${this.elapsed.toFixed(1)}s` : `${this.knocked.size}/10`
            status = sprint ? `GATE ${this.gate + 1}/8 · ${this.gate < 4 ? 'EAST →' : 'WEST ←'}${this.gate === 4 ? ' · Turn around; return on the lower lane.' : ''}` : `${Math.max(0, 8 - this.frameTime).toFixed(1)}s left · ${this.total} pins banked`
        }
        this.$value.textContent = value
        // Announce meaningful changes, not ten timer updates a second.
        const announcement = this.state === 'running' && !sprint ? `Frame ${this.frame}: ${this.knocked.size} pins. Drive through the ball.` : status
        if(this.$status.textContent !== announcement) this.$status.textContent = announcement
        this.$value.setAttribute('aria-label', status)
        this.$panel.querySelector('.arcade-progress span').style.transform = `scaleX(${sprint ? this.gate / 8 : (this.total + (this.state === 'running' ? this.knocked.size : 0)) / 30})`
        const showGate = sprint && ['running', 'countdown'].includes(this.state)
        this.gateGroup.visible = showGate
        this.gateMarker.visible = showGate
        if(showGate)
        {
            const gate = SPRINT_GATES[this.gate]
            this.gateGroup.position.set(gate.x, gate.y, 0)
            this.gateMarker.position.set(gate.x - gate.direction * 2, gate.y, 0.075)
            this.gateMarker.rotation.z = gate.direction > 0 ? 0 : Math.PI
        }
    }
}
