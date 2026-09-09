import * as THREE from 'three'
import CANNON from 'cannon'
import { createPerson } from './Pedestrians.js'
import { renderPosition } from '../Utils/renderTransform.js'

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
        this.skating = false
        this.board = this.createBoard(world.materials)
        this.board.visible = false
        world.container.add(this.board)
        this.body = new CANNON.Body({ mass: 65, fixedRotation: true, linearDamping: 0.1 })
        this.body.addShape(new CANNON.Sphere(0.38))
        this.body.collisionRole = 'player-on-foot'
        this.body.updateMassProperties()
        world.physics.getPlayerPosition = () => this.position
        // Which way the player is actually facing, for the rotating radar.
        // On foot that is the way the walker is pointed (or looking, in first
        // person); in the car it is the chassis heading.
        this.heading = 0
        world.physics.getPlayerHeading = () =>
        {
            if(!this.active) return world.physics.car.angle
            return this.firstPerson ? this.yaw : this.heading
        }
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
    // Physics settles on fixed steps; everything drawn reads the interpolated
    // pose so the walker, the board and the view all agree frame to frame.
    get renderPosition()
    {
        const body = this.active ? this.body : this.world.physics.car.chassis.body
        return renderPosition(body, this.world.time.delta / 1000)
    }
    get blocked() { return this.world.experienceDirector.locks.size > 0 || this.world.arcade.state !== 'idle' }

    // Deck, trucks and four wheels, in the same flat box language as the walker.
    createBoard(_materials)
    {
        const group = new THREE.Group()
        const box = new THREE.BoxGeometry(1, 1, 1)
        const part = (size, position, hex) =>
        {
            const mesh = new THREE.Mesh(box, _materials.getCelMaterial(new THREE.Color(hex)))
            mesh.scale.set(...size)
            mesh.position.set(...position)
            group.add(mesh)
        }
        part([0.44, 1.35, 0.07], [0, 0, 0.14], '#c2412d')
        part([0.36, 0.3, 0.05], [0, 0.48, 0.19], '#16130e')
        part([0.36, 0.3, 0.05], [0, - 0.48, 0.19], '#16130e')
        for(const y of [0.46, - 0.46]) for(const x of [- 0.22, 0.22])
            part([0.1, 0.16, 0.16], [x, y, 0.08], '#ffe7b0')
        return group
    }

    setInterface()
    {
        this.panel = document.createElement('section')
        this.panel.className = 'explorer-controls'
        this.panel.setAttribute('aria-label', 'Explore the city')
        this.panel.innerHTML = `<div class="explorer-controls__buttons">
            <button type="button" data-explorer="mode">Exit car <kbd>F</kbd></button>
            <button type="button" data-explorer="view" aria-pressed="false">First person <kbd>V</kbd></button>
            <button type="button" data-explorer="run" aria-pressed="false" hidden>Skateboard <kbd>Shift</kbd></button>
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
            if(action === 'run') this.setSkating(!this.skating)
        })
    }

    // The board is a toggle rather than a held key so touch gets it too: tap
    // once and you keep rolling, the way Stick RPG's skateboard works.
    setSkating(_next)
    {
        const was = this.skating
        this.skating = Boolean(_next)
        if(was !== this.skating)
        {
            // A kick to push off, deck-on-kerb to step down.
            this.world.sounds?.cues?.[this.skating ? 'boardPush' : 'boardOff']?.()
        }
        this.runButton.setAttribute('aria-pressed', String(this.skating))
        this.runButton.classList.toggle('is-on', this.skating)
        if(this.board) this.board.visible = this.active && this.skating
        this.updateInterface()
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
            if(this.active && (event.code === 'ShiftLeft' || event.code === 'ShiftRight') && !event.repeat)
            {
                event.preventDefault()
                this.setSkating(!this.skating)
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
        if(this.board) this.board.visible = false
        if(this.world.sounds?.board) this.world.sounds.board.speed = 0
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
        if(this.board) this.board.visible = this.active && this.skating && !this.firstPerson
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
            ? (this.active ? 'Joystick walks · Skateboard doubles your pace · Enter beside your car' : 'Exit car to explore on foot') + (this.firstPerson ? ' · Drag to look' : '')
            : this.active
                ? `WASD / arrows walk · Shift ${this.skating ? 'steps off the board' : 'grabs the skateboard'} · F enter car · E interact` + (this.firstPerson ? ' · Drag to look / Esc release mouse' : '')
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
            const speed = this.blocked || document.hidden ? 0 : (this.skating ? 7.6 : 3.2)
            const targetX = (Math.cos(angle) * forward + Math.sin(angle) * right) * speed / length
            const targetY = (Math.sin(angle) * forward - Math.cos(angle) * right) * speed / length

            // Ease into the target velocity rather than snapping to it. Snapping
            // every frame is what made walking feel stepped, and it fought the
            // solver whenever the walker was in contact with anything. The board
            // ramps slower in both directions, so it carries and coasts.
            const delta = Math.min(w.time.delta / 1000, 0.05)
            const rate = this.skating ? (forward || right ? 3.2 : 1.6) : 14
            const ease = 1 - Math.exp(- rate * delta)
            this.body.velocity.x += (targetX - this.body.velocity.x) * ease
            this.body.velocity.y += (targetY - this.body.velocity.y) * ease
            this.body.angularVelocity.set(0, 0, 0)

            const travelling = Math.hypot(this.body.velocity.x, this.body.velocity.y)
            const moving = travelling > 0.1
            if(moving) this.body.wakeUp()
            if(moving)
            {
                // Turn towards the heading over a few frames; a hard set makes
                // the avatar flick round whenever the input direction changes.
                const heading = Math.atan2(this.body.velocity.y, this.body.velocity.x) - Math.PI / 2
                const current = this.avatar.rotation.z
                const turn = Math.atan2(Math.sin(heading - current), Math.cos(heading - current))
                this.avatar.rotation.z = current + turn * Math.min(1, delta * (this.skating ? 8 : 16))
                this.heading = this.avatar.rotation.z + Math.PI / 2
            }
            this.phase += delta * travelling * 2.5
            const render = this.renderPosition
            this.avatar.position.set(render.x, render.y, render.z - 0.38)
            // On the board the legs stop cycling and the rider leans into the roll.
            this.avatar.userData.animate(this.phase, moving && !this.skating && !w.config.reducedMotion)
            if(this.board)
            {
                this.board.visible = this.skating
                this.board.position.copy(this.avatar.position)
                this.board.rotation.z = this.avatar.rotation.z
            }
            this.avatar.rotation.x = this.skating ? - 0.05 - Math.min(travelling / 7.6, 1) * 0.13 : 0

            // Rolling noise follows real speed, so kerbs and corners are audible.
            if(w.sounds?.board) w.sounds.board.speed = this.skating ? Math.min(travelling / 7.6, 1) : 0
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
        const p = this.renderPosition
        camera.position.set(p.x, p.y, p.z + (this.active ? 1.27 : 0.85))
        this.lookTarget.set(p.x + Math.cos(this.yaw) * Math.cos(this.pitch), p.y + Math.sin(this.yaw) * Math.cos(this.pitch), camera.position.z + Math.sin(this.pitch))
        camera.lookAt(this.lookTarget)
        camera.updateMatrixWorld()
    }
}
