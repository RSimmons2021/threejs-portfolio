import * as THREE from 'three'
import { Howler } from 'howler'
import Assets from './Assets.js'
import PacketRun from './PacketRun.js'
import BeatTunnel from './BeatTunnel.js'
import SignalNoise from './SignalNoise.js'
import Handoff from './Handoff.js'
import Containment from './Containment.js'
import ShipIt from './ShipIt.js'

const GAMES = { packetRun: PacketRun, beatTunnel: BeatTunnel, signalNoise: SignalNoise, handoff: Handoff, containment: Containment, shipIt: ShipIt }

export default class MiniGameDirector
{
    constructor(world)
    {
        this.world = world
        this.active = null
        this.state = 'idle'
        this.keys = new Set()
        this.debug = { resolve: passed => { if(this.active && this.game) { this.finish(passed, 'Debug lifecycle verification.', passed ? 'gold' : null); this.complete() } } }
        world.time.on('tick.miniGames', () => this.update())
        window.addEventListener('blur', () => this.pause())
        document.addEventListener('visibilitychange', () => { if(document.hidden) this.pause() })
        window.addEventListener('portfolio:navigate', () => this.destroy())
        window.addEventListener('keydown', event =>
        {
            if(!this.active) return
            if(event.code === 'Tab') return
            // Preserve native Enter/Space on focused controls, without passing
            // those keys through to world/game action handlers.
            if(['Enter', 'Space'].includes(event.code) && event.target instanceof Element && event.target.closest('button, a, input, select, textarea'))
            {
                event.stopPropagation()
                const hold = event.target.closest('button')?.dataset.gameHold
                if(hold && this.state === 'playing') { event.preventDefault(); this.keys.add(hold) }
                return
            }
            event.preventDefault(); event.stopImmediatePropagation()
            if(event.code === 'Escape') { this.destroy(); this.world.careerRPG.close(); return }
            this.keys.add(event.code)
            if(!event.repeat && this.state === 'playing') this.game?.action?.(event.code)
        }, true)
        window.addEventListener('keyup', event =>
        {
            if(!this.active) return
            const hold = event.target?.closest?.('button')?.dataset.gameHold
            if(hold && ['Enter', 'Space'].includes(event.code)) this.keys.delete(hold)
            this.keys.delete(event.code)
            event.stopPropagation()
        }, true)
    }

    start(id, onDone, { practice = false } = {})
    {
        if(this.active || !GAMES[id]) return { destroy() {} }
        // Arcade visitors may have parked elsewhere. Save a seated return pose;
        // the selected game then enters its own walking/flight arena mode.
        if(practice) this.world.explorer.enterCar(true)
        this.active = id
        this.returnFocus = document.activeElement
        this.practice = practice
        this.state = 'loading'
        this.onDone = onDone
        this.token = Symbol(id)
        const token = this.token
        this.setInterface()
        this.world.areas.clearHover()
        this.areaStates = this.world.areas.items.map(area => ({ area, active: area.active }))
        this.areaStates.forEach(({ area }) => area.deactivate())
        this.world.experienceDirector.setInteractionLock('minigame', true)
        this.world.resources.loadMiniGames().then(() =>
        {
            if(this.token !== token) return
            this.assets ||= new Assets(this.world)
            this.enter(id)
        }).catch(error =>
        {
            if(this.token !== token) return
            console.warn('Mini-game loading failed', error)
            this.$detail.textContent = 'Assets could not load. Return to the city and try again.'
            this.state = 'result'; this.result = { passed: false, summary: 'The arena could not load. Please try again.' }
            this.setButtons([{ label: 'Return to city', run: () => this.complete() }])
        })
        return { destroy: () => { if(this.token === token) this.destroy() } }
    }

    enter(id)
    {
        const w = this.world, e = w.explorer, car = w.physics.car.chassis.body
        this.saved = {
            active: e.active, firstPerson: e.firstPerson, skating: e.skating, yaw: e.yaw, pitch: e.pitch,
            walker: e.body.position.clone(), parked: e.parked,
            car: car.position.clone(), quaternion: car.quaternion.clone(),
            target: w.camera.targetOverride, near: w.camera.instance.near, fov: w.camera.fovKick.baseFov,
            flight: { mode: w.hoverFlight.mode, yaw: w.hoverFlight.yaw, fold: w.hoverFlight.fold, timer: w.hoverFlight.timer }
        }
        if(e.firstPerson) e.toggleView()
        this.ownsCar = id === 'packetRun' || id === 'beatTunnel'
        w.physics.car.miniGameOwnsPose = this.ownsCar
        this.ownsWalker = id === 'shipIt'
        if(this.ownsCar)
        {
            e.enterCar(true)
            w.hoverFlight.takeOff(true)
            w.hoverFlight.mode = 'flying'
        }
        this.root = new THREE.Group()
        this.root.name = `3D mini-game / ${id}`
        this.geometries = []
        this.disposables = []
        w.container.add(this.root)
        const canvas = document.createElement('canvas')
        canvas.width = 512; canvas.height = 256
        this.screenCanvas = canvas
        this.screenTexture = new THREE.CanvasTexture(canvas)
        this.screenTexture.colorSpace = THREE.SRGBColorSpace
        this.screenTexture.flipY = false
        this.origin = [0, 0, 0]
        this.elapsed = 0; this.countdown = 3
        this.cameraPosition = new THREE.Vector3()
        this.cameraLook = new THREE.Vector3()
        w.camera.targetOverride = new THREE.Vector3()
        w.camera.instance.near = 0.1
        this.game = new GAMES[id](this)
        this.state = 'ready'
        this.$title.textContent = this.game.title
        this.$status.textContent = 'READY / LEARN THE CONTROLS'
        this.$detail.textContent = this.game.instructions
        this.setButtons([{ label: 'Begin run · 3–2–1', run: () => this.begin() }])
        this.$actions.querySelector('button')?.focus({ preventScroll: true })
        this.updateCamera()
    }

    begin()
    {
        if(this.state !== 'ready') return
        this.state = 'countdown'
        this.countdown = 3
        this.setButtons(this.game.controls || [])
        this.$status.textContent = '3'
    }

    setInterface()
    {
        this.$panel = document.createElement('section')
        this.$panel.className = 'mini-game'
        this.$panel.setAttribute('aria-label', this.practice ? 'Free-practice mini-game' : '3D career mini-game')
        this.$panel.innerHTML = '<header><div><small>AFTER HOURS / CAREER CIRCUIT</small><h2 data-title>Loading arena…</h2></div><button type="button" data-mute aria-label="Toggle game sound">Sound</button><button type="button" data-exit aria-label="Exit game">Exit · Esc</button></header><p class="mini-game__status" data-status role="status">Loading…</p><p class="mini-game__detail" data-detail></p><div class="mini-game__actions" data-actions></div>'
        document.body.appendChild(this.$panel)
        if(this.practice) this.$panel.querySelector('small').textContent = 'AFTER HOURS / FREE PRACTICE · NO CAREER COST'
        document.body.classList.add('has-mini-game')
        this.$title = this.$panel.querySelector('[data-title]')
        this.$status = this.$panel.querySelector('[data-status]')
        this.$detail = this.$panel.querySelector('[data-detail]')
        this.$actions = this.$panel.querySelector('[data-actions]')
        this.$panel.querySelector('[data-exit]').onclick = () => { this.destroy(); this.world.careerRPG.close() }
        const mute = this.$panel.querySelector('[data-mute]')
        const updateMute = () => { mute.textContent = this.world.sounds.muted ? 'Sound off' : 'Sound on'; mute.setAttribute('aria-pressed', String(!this.world.sounds.muted)) }
        mute.onclick = () => { this.world.sounds.muted = !this.world.sounds.muted; Howler.mute(this.world.sounds.muted); updateMute() }
        updateMute()
        this.$panel.addEventListener('pointerdown', event => event.stopPropagation())
        this.swipeStart = event =>
        {
            if(this.active !== 'signalNoise' && this.active !== 'beatTunnel') return
            this.drag = { x: event.clientX, y: event.clientY, id: event.pointerId }
        }
        this.swipeMove = event =>
        {
            if(this.drag?.id !== event.pointerId || this.state !== 'playing') return
            if(this.active === 'beatTunnel') this.game.drag(event.clientX - this.drag.x, event.clientY - this.drag.y)
        }
        this.swipeEnd = event =>
        {
            if(this.drag?.id !== event.pointerId) return
            const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y
            if(this.active === 'signalNoise' && this.state === 'playing' && Math.hypot(dx, dy) > 30)
                this.game.action(Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'KeyA' : 'KeyD' : 'KeyS')
            if(this.active === 'beatTunnel') this.game.drag(0, 0)
            this.drag = null
        }
        this.world.renderer.domElement.addEventListener('pointerdown', this.swipeStart)
        window.addEventListener('pointermove', this.swipeMove)
        window.addEventListener('pointerup', this.swipeEnd)
        window.addEventListener('pointercancel', this.swipeEnd)
    }

    setButtons(buttons)
    {
        this.$actions.replaceChildren()
        for(const item of buttons)
        {
            const button = document.createElement('button')
            button.type = 'button'; button.textContent = item.label
            if(item.hold)
            {
                button.dataset.gameHold = item.hold
                button.onpointerdown = event => { event.preventDefault(); if(event.isTrusted) button.setPointerCapture(event.pointerId); this.keys.add(item.hold) }
                button.onpointerup = button.onpointercancel = () => this.keys.delete(item.hold)
            }
            else button.onclick = () => { if(item.run) item.run(); else if(this.state === 'playing') this.game.action(item.key) }
            this.$actions.appendChild(button)
        }
    }

    held(...codes) { return codes.some(code => this.keys.has(code)) }
    axis(positive, negative) { return Number(this.held(...positive)) - Number(this.held(...negative)) }
    hud(status, detail)
    {
        if(this.$status.textContent !== status) this.$status.textContent = status
        if(detail && this.$detail.textContent !== detail) this.$detail.textContent = detail
        if(this.world.time.elapsed - (this.lastScreen || 0) < 100) return
        this.lastScreen = this.world.time.elapsed
        const ctx = this.screenCanvas.getContext('2d')
        ctx.fillStyle = '#07131e'; ctx.fillRect(0, 0, 512, 256)
        ctx.fillStyle = '#22e5ff'; ctx.font = 'bold 28px monospace'; ctx.fillText((this.game?.title || this.active).toUpperCase(), 18, 42)
        ctx.fillStyle = '#f1fbff'; ctx.font = '20px monospace'
        status.split(' · ').forEach((line, i) => ctx.fillText(line, 18, 82 + i * 30))
        this.screenTexture.needsUpdate = true
    }

    cue(good = true) { const cues = this.world.sounds?.cues; if(good) cues?.rulingCorrect?.(); else cues?.rulingWrong?.() }
    pause()
    {
        this.keys.clear()
        if(!['playing', 'countdown'].includes(this.state)) return
        this.beforePause = this.state; this.state = 'paused'
        this.game.stop?.()
        this.$status.textContent = 'PAUSED'
        this.setButtons([{ label: 'Resume run', run: () => { this.state = this.beforePause; this.setButtons(this.game.controls || []) } }])
    }

    update()
    {
        if(!this.active || !this.game) return
        const dt = Math.min(this.world.time.delta / 1000, 0.05)
        if(this.ownsCar && this.state !== 'playing') this.world.physics.car.chassis.body.velocity.set(0, 0, 0)
        if(this.state === 'countdown')
        {
            this.countdown -= dt
            this.$status.textContent = String(Math.max(1, Math.ceil(this.countdown)))
            if(this.countdown <= 0) { this.state = 'playing'; this.game.next?.() }
        }
        if(this.state === 'playing') { this.elapsed += dt; this.game.update(dt) }
        this.game.frame?.()
    }

    updateCamera()
    {
        if(!this.active || !this.game) return
        this.game.camera?.()
        const camera = this.world.camera.instance
        camera.position.copy(this.cameraPosition)
        camera.up.set(0, 0, 1); camera.lookAt(this.cameraLook)
        camera.fov = this.game.cameraFov?.(camera.aspect) || (this.ownsCar ? 66 : this.ownsWalker ? 58 : 65)
        camera.updateProjectionMatrix(); camera.updateMatrixWorld()
    }

    finish(passed, summary, medal)
    {
        if(this.state === 'result' || !this.active) return
        this.state = 'result'; this.keys.clear()
        this.game.stop?.()
        this.result = { passed, summary, medal }
        const stamp = this.active === 'containment' ? passed ? 'CONTAINED' : 'BREACH' : this.active === 'shipIt' && passed ? 'SHIPPED' : passed ? 'PASS' : 'TRY AGAIN'
        this.$status.textContent = `${stamp}${medal ? ` / ${medal.toUpperCase()}` : ''}`
        this.$detail.textContent = summary
        this.$panel.dataset.result = passed ? 'pass' : 'fail'
        if(passed)
        {
            for(const store of ['localStorage', 'sessionStorage'])
            {
                try
                {
                    const storage = window[store], key = `neon-minigame-${this.active}`
                    const previous = JSON.parse(storage.getItem(key) || 'null')
                    const rank = { bronze: 1, silver: 2, gold: 3 }
                    if(!previous || rank[medal] >= rank[previous.medal]) storage.setItem(key, JSON.stringify({ medal, summary }))
                    break
                }
                catch { /* private browsing: fall back to session storage */ }
            }
        }
        const buttons = [{ label: this.practice ? 'Return to arcade' : 'Return to career / collect result', run: () => this.complete() }]
        if(this.practice) buttons.unshift({ label: 'Play again · free', run: () =>
        {
            const id = this.active, callback = this.onDone
            this.destroy(); this.start(id, callback, { practice: true })
        } })
        this.setButtons(buttons)
        const card = this.assets?.cards.find(c => c.id === `stamp_${stamp.toLowerCase()}`)
        if(card)
        {
            const canvas = document.createElement('canvas')
            canvas.className = 'mini-game__stamp'; canvas.width = 300; canvas.height = 160
            const img = this.assets.texture.image, [u0, v0, u1, v1] = card.uv
            canvas.getContext('2d').drawImage(img, u0 * img.width, (1 - v1) * img.height, (u1 - u0) * img.width, (v1 - v0) * img.height, 0, 0, 300, 160)
            this.$panel.insertBefore(canvas, this.$actions)
        }
    }

    complete()
    {
        if(!this.result) return
        const callback = this.onDone, result = this.result
        this.onDone = null
        this.destroy()
        callback?.(result.passed, result.summary)
    }

    destroy()
    {
        if(!this.active) return
        const w = this.world, e = w.explorer, car = w.physics.car.chassis.body
        this.token = null
        this.game?.stop?.()
        if(this.saved)
        {
            const flight = this.saved.flight
            if(this.ownsCar && flight.mode === 'grounded') w.hoverFlight.forceLand()
            car.position.copy(this.saved.car); car.quaternion.copy(this.saved.quaternion)
            car.velocity.set(0, 0, 0); car.angularVelocity.set(0, 0, 0)
            if(this.saved.active && !e.active)
            {
                e.active = true; w.physics.onFoot = true; w.physics.world.addBody(e.body)
            }
            if(!this.saved.active && e.active) e.enterCar(true)
            if(flight.mode !== 'grounded')
            {
                // Ship It temporarily lands the parked car while the rider is
                // on its rooftop. Reattach flight, not the ground wheels, on return.
                if(!w.hoverFlight.airborne) w.hoverFlight.takeOff(true)
                w.hoverFlight.mode = flight.mode; w.hoverFlight.yaw = flight.yaw
                w.hoverFlight.fold = flight.fold; w.hoverFlight.timer = flight.timer
                document.body.classList.add('is-flying')
                car.velocity.set(0, 0, 0)
            }
            e.body.position.copy(this.saved.walker); e.body.velocity.set(0, 0, 0)
            e.parked = this.saved.parked
            e.yaw = this.saved.yaw; e.pitch = this.saved.pitch; e.setSkating(this.saved.skating)
            if(e.firstPerson !== this.saved.firstPerson) e.toggleView()
            e.avatar.visible = e.active && !e.firstPerson
            w.camera.targetOverride = this.saved.target
            w.camera.instance.near = this.saved.near
            w.camera.fovKick.baseFov = this.saved.fov
        }
        this.root?.removeFromParent()
        this.geometries?.forEach(g => g.dispose())
        this.disposables?.forEach(resource => resource.dispose())
        this.disposables = null
        for(const key of ['screenMaterial', 'cardMaterial', 'windowMaterial', 'beltMaterial', 'screenTexture']) { this[key]?.dispose(); this[key] = null }
        w.renderer.domElement.removeEventListener('pointerdown', this.swipeStart)
        window.removeEventListener('pointermove', this.swipeMove)
        window.removeEventListener('pointerup', this.swipeEnd)
        window.removeEventListener('pointercancel', this.swipeEnd)
        this.$panel?.remove()
        this.areaStates?.forEach(({ area, active }) => { if(active) area.activate() })
        this.areaStates = null
        this.keys.clear(); this.active = null; this.game = null; this.saved = null; this.result = null
        this.ownsCar = this.ownsWalker = false; this.state = 'idle'
        w.physics.car.miniGameOwnsPose = false
        document.body.classList.remove('has-mini-game')
        w.experienceDirector.setInteractionLock('minigame', false)
        // The outer career lock captured the pre-game pose; don't keep a stale pin.
        w.experienceDirector.lockedCarPose = null
        w.controls.actions.up = w.controls.actions.down = w.controls.actions.left = w.controls.actions.right = false
        w.hoverFlight.keys.climb = w.hoverFlight.keys.descend = false
        w.hoverFlight.touchClimb = w.hoverFlight.touchDescend = false
        w.cameraRig.initialised = false
        e.updateInterface()
        const returnFocus = this.returnFocus
        this.returnFocus = null
        window.requestAnimationFrame(() =>
        {
            if(this.active || document.querySelector('dialog[open]')) return
            if(returnFocus?.isConnected) returnFocus.focus({ preventScroll: true })
            if(document.activeElement === document.body) w.renderer.domElement.focus({ preventScroll: true })
        })
    }
}
