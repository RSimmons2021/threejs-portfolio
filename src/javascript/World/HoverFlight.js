import * as THREE from 'three'
import CANNON from 'cannon'
import { FLIGHT_CEILING, SOFT_CEILING, ceilingVelocity } from './flightRules.js'

// Drive <-> fly for the Neon District hover car.
//   T            take off / land
//   W/S, A/D     thrust, yaw (same keys as driving), Shift boost
//   E / Q        climb / descend
// GROUNDED: the RaycastVehicle drives as before and the pods are wheels.
// FLYING: the vehicle constraint is removed; this module steers the chassis body
// directly (velocity tracking + gravity cancel), so collisions still push it around.
const CRUISE = 18, BOOST = 30, CLIMB = 8, DESCEND = 10, MIN_ALT = 1.5

export default class HoverFlight
{
    constructor(world)
    {
        this.world = world
        this.physics = world.physics
        this.car = world.physics.car
        this.spec = world.resources.items.hoverCarSpec
        const authoredBounds = world.resources.items.cyberLayout.flightBounds
        this.bounds = { ...authoredBounds, max: [...authoredBounds.max.slice(0, 2), FLIGHT_CEILING], softCeiling: SOFT_CEILING }
        this.mode = 'grounded'
        this.fold = 0
        this.timer = 0
        this.yaw = 0
        this.altitude = 0
        this.keys = { climb: false, descend: false }
        this.visual = { roll: 0, pitch: 0 }
        this.ray = new CANNON.Ray()
        this.rayResult = new CANNON.RaycastResult()
        this.car.hover = this
        this.bind()
        this.setInterface()
        this.physics.world.addEventListener('preStep', () => this.step(1 / 60))
        world.time.on('tick', () => this.tick())
        window.addEventListener('portfolio:navigate', () => this.forceLand())
    }

    get airborne() { return this.mode !== 'grounded' }

    get blocked()
    {
        const w = this.world
        return w.physics.onFoot || w.arcade?.state !== 'idle' || w.experienceDirector?.locks?.size > 0 || !!w.camera.targetOverride
    }

    bind()
    {
        const field = (event) => event.target?.closest?.('input, textarea, select, [contenteditable="true"], dialog')
        window.addEventListener('keydown', (event) =>
        {
            if(field(event)) return
            if(event.code === 'KeyT' && !event.repeat) { event.preventDefault(); this.toggle() }
            if(event.code === 'KeyE') this.keys.climb = true
            if(event.code === 'KeyQ') this.keys.descend = true
        })
        window.addEventListener('keyup', (event) =>
        {
            if(event.code === 'KeyE') this.keys.climb = false
            if(event.code === 'KeyQ') this.keys.descend = false
        })
        window.addEventListener('blur', () => { this.keys.climb = this.keys.descend = false })
    }

    setInterface()
    {
        const explorer = this.world.explorer
        this.button = document.createElement('button')
        this.button.type = 'button'
        this.button.dataset.flight = 'toggle'
        explorer?.panel.querySelector('.explorer-controls__buttons')?.prepend(this.button)
        this.button.addEventListener('click', (event) => { event.stopPropagation(); this.toggle() })
        // Touch: hold to climb / descend while airborne.
        this.pad = document.createElement('div')
        this.pad.className = 'flight-pad'
        this.pad.hidden = true
        this.pad.innerHTML = '<button type="button" data-dir="climb" aria-label="Climb">▲</button><button type="button" data-dir="descend" aria-label="Descend">▼</button>'
        document.body.appendChild(this.pad)
        for(const b of this.pad.querySelectorAll('button'))
        {
            const key = b.dataset.dir === 'climb' ? 'touchClimb' : 'touchDescend'
            const on = (e) => { e.preventDefault(); this[key] = true }
            const off = () => { this[key] = false }
            b.addEventListener('pointerdown', on)
            b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off)
        }
        this.lastUi = ''
    }

    updateInterface()
    {
        const onFoot = this.world.explorer?.active
        const state = `${this.mode}|${onFoot}`
        if(state === this.lastUi) return
        this.lastUi = state
        this.button.hidden = !!onFoot
        this.button.innerHTML = this.mode === 'grounded' ? 'Take off <kbd>T</kbd>' : 'Land <kbd>T</kbd>'
        this.button.setAttribute('aria-pressed', String(this.mode !== 'grounded'))
        this.pad.hidden = !this.airborne || !!onFoot
        this.world.explorer?.updateInterface()
    }

    toggle()
    {
        if(this.mode === 'grounded') this.takeOff()
        else if(this.mode === 'flying') this.beginLanding()
    }

    beginLanding()
    {
        if(this.mode === 'landing' || this.mode === 'grounded') return
        this.mode = 'landing'
        this.world.sounds?.playVehicleTransform('down')
    }

    takeOff(forMiniGame = false)
    {
        if((this.blocked && !forMiniGame) || this.mode !== 'grounded') return
        const body = this.car.chassis.body
        // removeFromWorld also removes the chassis body; keep the body, drop the wheels.
        this.car.vehicle.removeFromWorld(this.physics.world)
        this.physics.world.addBody(body)
        this.yaw = this.car.angle
        this.mode = 'takeoff'
        this.timer = 0
        body.wakeUp()
        body.velocity.z = Math.max(body.velocity.z, 3)
        this.world.sounds?.playVehicleTransform('up')
        this.world.dispatchFlightChange?.(true)
        document.body.classList.add('is-flying')
    }

    touchDown()
    {
        if(this.mode !== 'landing') this.world.sounds?.playVehicleTransform('down')
        const body = this.car.chassis.body
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), this.yaw)
        body.angularVelocity.set(0, 0, 0)
        body.velocity.scale(0.3, body.velocity)
        this.physics.world.removeBody(body)
        this.car.vehicle.addToWorld(this.physics.world)
        this.mode = 'grounded'
        document.body.classList.remove('is-flying')
    }

    // Tour, project navigation and the arcade need the car on the road immediately.
    forceLand()
    {
        if(this.mode === 'grounded') return
        const body = this.car.chassis.body
        body.position.z = Math.min(body.position.z, this.surfaceBelow() + 1.2)
        body.velocity.set(0, 0, 0)
        this.touchDown()
        this.fold = 0
    }

    surfaceBelow()
    {
        const body = this.car.chassis.body
        const from = new CANNON.Vec3(body.position.x, body.position.y, body.position.z - 0.6)
        const to = new CANNON.Vec3(body.position.x, body.position.y, body.position.z - 300)
        this.rayResult.reset()
        this.ray.from.copy(from); this.ray.to.copy(to)
        this.ray.mode = CANNON.Ray.CLOSEST
        this.ray.skipBackfaces = true
        this.ray.collisionFilterMask = -1
        this.ray.intersectWorld(this.physics.world, { mode: CANNON.Ray.CLOSEST, result: this.rayResult, skipBackfaces: true })
        return this.rayResult.hasHit ? this.rayResult.hitPointWorld.z : 0
    }

    step(dt)
    {
        if(this.mode === 'grounded') return
        const body = this.car.chassis.body
        const controls = this.world.controls
        const a = controls.actions
        // Cancel gravity so altitude is held with no input.
        body.force.z += -this.physics.world.gravity.z * body.mass
        if(this.world.miniGames?.ownsCar) return

        let throttle = a.up ? 1 : a.down ? -0.55 : 0
        let turn = (a.left ? 1 : 0) - (a.right ? 1 : 0)
        const joystick = controls.touch?.joystick
        if(joystick?.active)
        {
            const delta = Math.atan2(Math.sin(joystick.angle.value - this.yaw), Math.cos(joystick.angle.value - this.yaw))
            turn = THREE.MathUtils.clamp(delta * 1.4, -1, 1)
            throttle = Math.max(throttle, Math.cos(delta) > 0 ? 0.85 : 0.2)
        }
        const boost = a.boost
        const yawRate = (boost ? 1.15 : 1.6) * turn
        this.yaw += yawRate * dt
        const speed = throttle * (boost ? BOOST : CRUISE)

        const surface = this.surfaceBelow()
        this.altitude = body.position.z - surface
        let vz = (this.keys.climb || this.touchClimb ? CLIMB : 0) - (this.keys.descend || this.touchDescend ? DESCEND : 0)
        if(this.mode === 'takeoff')
        {
            this.timer += dt
            vz = 4.5
            if(this.timer > 0.8) this.mode = 'flying'
        }
        if(this.mode === 'landing')
        {
            vz = -Math.max(3, Math.min(14, this.altitude * 0.9))
            if(this.altitude < 0.75) { this.touchDown(); return }
        }
        if(this.mode === 'flying')
        {
            vz = ceilingVelocity(body.position.z, vz)
            if(this.altitude < MIN_ALT) vz = Math.max(vz, (MIN_ALT - this.altitude) * 4)
            if((this.keys.descend || this.touchDescend) && this.altitude < MIN_ALT + 0.3 && Math.abs(speed) < 6) this.beginLanding()
        }
        const target = new CANNON.Vec3(Math.cos(this.yaw) * speed, Math.sin(this.yaw) * speed, vz)
        // Soft walls at the district edge.
        const b = this.bounds, margin = 10
        const push = (v, lo, hi) => v < lo + margin ? (lo + margin - v) * 1.5 : v > hi - margin ? -(v - hi + margin) * 1.5 : 0
        target.x += push(body.position.x, b.min[0], b.max[0])
        target.y += push(body.position.y, b.min[1], b.max[1])
        const k = 1 - Math.exp(-dt * 3.2)
        body.velocity.x += (target.x - body.velocity.x) * k
        body.velocity.y += (target.y - body.velocity.y) * k
        body.velocity.z += (target.z - body.velocity.z) * (1 - Math.exp(-dt * 4))
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), this.yaw)
        body.angularVelocity.set(0, 0, 0)
        this.turn = turn
        this.throttle = throttle
    }

    tick()
    {
        const dt = Math.min(this.world.time.delta, 50) / 1000
        if(this.airborne && (this.world.arcade?.state !== 'idle' || this.world.physics.onFoot)) this.forceLand()
        const goal = this.mode === 'grounded' || this.mode === 'landing' && this.altitude < 1.4 ? 0 : 1
        this.fold += (goal - this.fold) * Math.min(1, dt * 3.5)
        if(Math.abs(goal - this.fold) < 0.002) this.fold = goal
        const reduced = this.world.config.reducedMotion
        const roll = this.airborne && !reduced ? -(this.turn || 0) * 0.32 : 0
        const pitch = this.airborne && !reduced ? -(this.throttle || 0) * 0.07 : 0
        this.visual.roll += (roll - this.visual.roll) * Math.min(1, dt * 4)
        this.visual.pitch += (pitch - this.visual.pitch) * Math.min(1, dt * 4)
        this.visual.bob = this.airborne && !reduced ? Math.sin(this.world.time.elapsed * 0.0025) * 0.06 * this.fold : 0
        const thruster = this.world.materials.cyber?.thruster
        if(thruster) thruster.uniforms.uCelEmission.value = 0.0001 + this.fold * (this.world.controls.actions.boost ? 4.2 : 2.6)
        this.updateInterface()
        this.car.mode = this.mode
        this.car.altitude = this.altitude
    }
}
