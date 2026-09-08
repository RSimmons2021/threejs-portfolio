import * as THREE from 'three'
import CANNON from 'cannon'
import { createPerson } from './Pedestrians.js'

export default class Explorer
{
    constructor(world)
    {
        this.world = world
        this.active = false
        this.firstPerson = false
        this.yaw = -Math.PI / 2
        this.pitch = 0
        this.phase = 0
        this.lookTarget = new THREE.Vector3()
        this.avatar = createPerson(world.materials)
        this.avatar.visible = false
        world.container.add(this.avatar)
        this.body = new CANNON.Body({ mass: 65, fixedRotation: true, linearDamping: 0.1 })
        this.body.addShape(new CANNON.Sphere(0.38))
        this.body.collisionRole = 'player-on-foot'
        this.body.updateMassProperties()
        world.physics.getPlayerPosition = () => this.position
        const explorer = this
        this.proximity = { get position() { return explorer.position } }
        world.areas.car = this.proximity
        world.areas.items.forEach(area => { area.car = this.proximity })
        this.setInterface()
        this.bindInput()
        world.time.on('tick', () => this.update())
        window.addEventListener('portfolio:navigate', () => this.enterCar(true))
    }

    get position() { return this.active ? this.body.position : this.world.physics.car.chassis.body.position }
    get blocked() { return this.world.experienceDirector.locks.size > 0 || this.world.arcade.state !== 'idle' }

    setInterface()
    {
        this.panel = document.createElement('section')
        this.panel.className = 'explorer-controls'
        this.panel.setAttribute('aria-label', 'Explore the city')
        this.panel.innerHTML = `<div class="explorer-controls__buttons">
            <button type="button" data-explorer="mode">Exit car <kbd>F</kbd></button>
            <button type="button" data-explorer="view" aria-pressed="false">First person <kbd>V</kbd></button>
            <button type="button" data-explorer="run" aria-pressed="false" hidden>Run</button>
            </div><p role="status">F exit car · V first person</p>`
        document.body.appendChild(this.panel)
        this.modeButton = this.panel.querySelector('[data-explorer="mode"]')
        this.viewButton = this.panel.querySelector('[data-explorer="view"]')
        this.runButton = this.panel.querySelector('[data-explorer="run"]')
        this.hint = this.panel.querySelector('p')
        this.panel.addEventListener('click', event =>
        {
            const action = event.target.closest('button')?.dataset.explorer
            if(this.blocked) return
            if(action === 'mode') this.active ? this.enterCar() : this.exitCar()
            if(action === 'view') this.toggleView()
            if(action === 'run')
            {
                this.running = !this.running
                this.runButton.setAttribute('aria-pressed', String(this.running))
            }
        })
    }

    bindInput()
    {
        document.addEventListener('keydown', event =>
        {
            if(event.target?.closest?.('input, textarea, select, [contenteditable="true"], dialog')) return
            if(['KeyF', 'KeyV'].includes(event.code) && !event.repeat && !this.blocked)
            {
                event.preventDefault()
                event.stopImmediatePropagation()
                if(event.code === 'KeyF') this.active ? this.enterCar() : this.exitCar()
                else this.toggleView()
            }
            if(this.active && event.code === 'KeyR') { event.preventDefault(); event.stopImmediatePropagation() }
        }, true)
        document.addEventListener('keyup', event =>
        {
            if(this.active && event.code === 'KeyR') { event.preventDefault(); event.stopImmediatePropagation() }
        }, true)
        const clear = () =>
        {
            this.world.guidedTour.clearControls()
            this.body.velocity.set(0, 0, 0)
            this.drag = null
            if(document.pointerLockElement) document.exitPointerLock()
        }
        window.addEventListener('blur', clear)
        document.addEventListener('visibilitychange', () => { if(document.hidden) clear() })
        const canvas = this.world.renderer.domElement
        canvas.addEventListener('pointerdown', event =>
        {
            if(!this.firstPerson || this.blocked) return
            this.drag = { x: event.clientX, y: event.clientY, id: event.pointerId }
            if(event.pointerType === 'mouse') canvas.requestPointerLock?.()?.catch?.(() => {})
        })
        window.addEventListener('pointermove', event =>
        {
            if(!this.firstPerson || this.blocked) return
            const locked = document.pointerLockElement === canvas
            if(!locked && (!this.drag || this.drag.id !== event.pointerId)) return
            const dx = locked ? event.movementX : event.clientX - this.drag.x
            const dy = locked ? event.movementY : event.clientY - this.drag.y
            this.yaw -= dx * 0.003
            this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.003, -1.1, 1.1)
            if(this.drag) { this.drag.x = event.clientX; this.drag.y = event.clientY }
        })
        window.addEventListener('pointerup', () => { this.drag = null })
    }

    exitCar()
    {
        if(this.blocked || this.active) return
        const w = this.world, car = w.physics.car.chassis.body
        if(car.position.z > 2) return
        // Test candidate exits against existing bodies so a parked car beside a
        // wall cannot spawn the walker inside it.
        const offsets = [[0, 2], [0, -2], [2.8, 0], [-2.8, 0], [0, 3.5]]
        const spot = offsets.map(([x, y]) => ({ x: car.position.x + x, y: car.position.y + y })).find(p =>
            !w.physics.world.bodies.some(body =>
            {
                if(body === car || !body.collisionResponse || body.shapes.some(shape => shape.type === CANNON.Shape.types.PLANE)) return false
                body.computeAABB()
                const a = body.aabb
                return a.upperBound.z > 0.5 && a.lowerBound.z < 1.8 &&
                    p.x > a.lowerBound.x - 0.4 && p.x < a.upperBound.x + 0.4 &&
                    p.y > a.lowerBound.y - 0.4 && p.y < a.upperBound.y + 0.4
            }))
        if(!spot) { this.hint.textContent = 'Move the car into an open space to get out.'; return }
        w.guidedTour.clearControls()
        this.parked = { position: car.position.clone(), quaternion: car.quaternion.clone() }
        w.physics.onFoot = true
        this.body.position.set(spot.x, spot.y, 0.6)
        this.body.velocity.set(0, 0, 0)
        w.physics.world.addBody(this.body)
        this.active = true
        this.yaw = w.physics.car.angle
        this.avatar.visible = !this.firstPerson
        w.camera.pan.disable()
        this.updateInterface()
    }

    enterCar(force = false)
    {
        if(!this.active) return
        if(!force && (this.blocked || this.distanceToCar() > 4))
        {
            this.hint.textContent = 'Walk back to your F1 car to get in.'
            return
        }
        this.world.physics.world.removeBody(this.body)
        this.active = false
        this.world.physics.onFoot = false
        this.avatar.visible = false
        this.world.guidedTour.clearControls()
        this.world.physics.car.chassis.body.wakeUp()
        this.lastCarAngle = this.world.physics.car.angle
        this.world.camera.pan.enable()
        if(force && this.firstPerson) this.toggleView()
        this.updateInterface()
    }

    distanceToCar()
    {
        const car = this.world.physics.car.chassis.body.position
        return Math.hypot(car.x - this.body.position.x, car.y - this.body.position.y)
    }

    toggleView()
    {
        this.firstPerson = !this.firstPerson
        this.yaw = this.active ? this.yaw : this.world.physics.car.angle
        this.lastCarAngle = this.world.physics.car.angle
        this.pitch = 0
        const camera = this.world.camera
        camera.firstPerson = this.firstPerson
        camera.instance.near = this.firstPerson ? 0.08 : 1
        camera.fovKick.baseFov = this.firstPerson ? 75 : 40
        camera.instance.fov = camera.fovKick.baseFov
        camera.instance.updateProjectionMatrix()
        this.avatar.visible = this.active && !this.firstPerson
        if(this.firstPerson) camera.pan.disable()
        else
        {
            if(!this.active) camera.pan.enable()
            if(document.pointerLockElement) document.exitPointerLock()
        }
        this.updateInterface()
    }

    updateInterface()
    {
        document.body.classList.toggle('is-on-foot', this.active)
        document.body.classList.toggle('is-first-person', this.firstPerson)
        this.modeButton.innerHTML = this.active ? 'Enter car <kbd>F</kbd>' : 'Exit car <kbd>F</kbd>'
        this.viewButton.innerHTML = this.firstPerson ? 'City view <kbd>V</kbd>' : 'First person <kbd>V</kbd>'
        this.viewButton.setAttribute('aria-pressed', String(this.firstPerson))
        this.runButton.hidden = !this.active
        this.world.experienceHUD.updateInstructionText()
        const touch = this.world.config.touch || window.matchMedia('(max-width: 767px)').matches
        this.hint.textContent = touch
            ? (this.active ? 'Joystick walks · Run changes pace · Enter beside your car' : 'Exit car to explore on foot') + (this.firstPerson ? ' · Drag to look' : '')
            : this.active
                ? 'WASD / arrows walk · Shift run · F enter car · E interact' + (this.firstPerson ? ' · Drag to look / Esc release mouse' : '')
                : 'F exit car · V change view' + (this.firstPerson ? ' · Click / drag to look · Esc release mouse' : '')
    }

    update()
    {
        const w = this.world
        this.panel.hidden = this.blocked
        if(this.blocked && document.pointerLockElement) document.exitPointerLock()
        if(this.active)
        {
            const car = w.physics.car.chassis.body
            car.position.copy(this.parked.position)
            car.quaternion.copy(this.parked.quaternion)
            car.velocity.set(0, 0, 0)
            car.angularVelocity.set(0, 0, 0)
            const a = w.controls.actions
            let forward = Number(a.up) - Number(a.down)
            let right = Number(a.right) - Number(a.left)
            const joystick = w.controls.touch?.joystick
            if(joystick?.active)
            {
                forward = Math.sin(joystick.angle.originalValue)
                right = Math.cos(joystick.angle.originalValue)
            }
            const angle = this.firstPerson ? this.yaw : Math.atan2(-w.camera.angle.value.y, -w.camera.angle.value.x)
            const length = Math.max(1, Math.hypot(forward, right))
            const speed = this.blocked || document.hidden ? 0 : (a.boost || this.running ? 7 : 3.2)
            this.body.velocity.x = (Math.cos(angle) * forward + Math.sin(angle) * right) * speed / length
            this.body.velocity.y = (Math.sin(angle) * forward - Math.cos(angle) * right) * speed / length
            this.body.angularVelocity.set(0, 0, 0)
            const moving = Math.hypot(this.body.velocity.x, this.body.velocity.y) > 0.1
            if(moving) this.body.wakeUp()
            if(moving) this.avatar.rotation.z = Math.atan2(this.body.velocity.y, this.body.velocity.x) - Math.PI / 2
            this.phase += Math.min(w.time.delta / 1000, 0.05) * speed * 2.5
            this.avatar.position.set(this.body.position.x, this.body.position.y, this.body.position.z - 0.38)
            this.avatar.userData.animate(this.phase, moving && !w.config.reducedMotion)
            if(this.body.position.z < -5) this.body.position.set(this.parked.position.x, this.parked.position.y + 2, 1)
        }
    }

    // Called immediately before render so the normal camera tick, zone tweens,
    // and speed effects cannot overwrite the first-person pose.
    updateCamera()
    {
        if(!this.firstPerson || this.blocked) return
        const camera = this.world.camera.instance
        if(!this.active)
        {
            const angle = this.world.physics.car.angle
            this.yaw += Math.atan2(Math.sin(angle - this.lastCarAngle), Math.cos(angle - this.lastCarAngle))
            this.lastCarAngle = angle
        }
        const p = this.position
        camera.position.set(p.x, p.y, p.z + (this.active ? 1.27 : 0.85))
        this.lookTarget.set(p.x + Math.cos(this.yaw) * Math.cos(this.pitch), p.y + Math.sin(this.yaw) * Math.cos(this.pitch), camera.position.z + Math.sin(this.pitch))
        camera.lookAt(this.lookTarget)
        camera.updateMatrixWorld()
    }
}
