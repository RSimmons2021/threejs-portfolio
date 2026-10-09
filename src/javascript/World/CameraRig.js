import * as THREE from 'three'

// Neon District camera: a chase camera behind the car (or walker) that pulls in
// when a tower is in the way. Drag to orbit, wheel / pinch to zoom, C toggles
// the classic angled camera. Systems that set camera.targetOverride (tour,
// director, arcade) and first person keep full control while active.
export default class CameraRig
{
    constructor(world)
    {
        this.world = world
        this.camera = world.camera
        this.camera.chaseRig = this
        this.instance = world.camera.instance
        this.colliders = world.neonCity?.colliders || []
        this.position = new THREE.Vector3()
        this.look = new THREE.Vector3()
        this.desired = new THREE.Vector3()
        this.target = new THREE.Vector3()
        this.ray = new THREE.Ray()
        this.hit = new THREE.Vector3()
        this.toCam = new THREE.Vector3()
        this.ahead = new THREE.Vector3()
        this.lastSubject = new THREE.Vector3()
        this.yaw = 0
        this.orbit = { yaw: 0, pitch: 0, idle: 0, drag: null }
        this.distanceScale = 1
        this.pull = 1
        this.initialised = false
        let saved = null
        try { saved = localStorage.getItem('portfolio-camera') } catch {}
        this.mode = saved === 'classic' ? 'classic' : 'chase'
        this.bind()
        this.applyMode()
    }

    bind()
    {
        const canvas = this.world.renderer.domElement
        window.addEventListener('keydown', (event) =>
        {
            if(event.code !== 'KeyC' || event.repeat || event.target?.closest?.('input, textarea, select, [contenteditable="true"], dialog[open]')) return
            this.mode = this.mode === 'chase' ? 'classic' : 'chase'
            try { localStorage.setItem('portfolio-camera', this.mode) } catch {}
            this.applyMode()
        })
        canvas.addEventListener('pointerdown', (event) =>
        {
            if(!this.active || (event.pointerType === 'touch' && !event.isPrimary)) return
            this.orbit.drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
        })
        window.addEventListener('pointermove', (event) =>
        {
            const drag = this.orbit.drag
            if(!drag || drag.id !== event.pointerId) return
            this.orbit.yaw -= (event.clientX - drag.x) * 0.006
            this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + (event.clientY - drag.y) * 0.004, -0.35, 0.9)
            drag.x = event.clientX; drag.y = event.clientY
            this.orbit.idle = 0
        })
        window.addEventListener('pointerup', () => { this.orbit.drag = null })
        window.addEventListener('wheel', (event) =>
        {
            if(!this.active) return
            this.distanceScale = THREE.MathUtils.clamp(this.distanceScale + event.deltaY * 0.0012, 0.6, 2.2)
        }, { passive: true })
    }

    applyMode()
    {
        document.body.classList.toggle('is-chase-camera', this.mode === 'chase')
        if(this.mode === 'chase') this.camera.pan.disable()
        else if(!this.world.explorer?.active) this.camera.pan.enable()
        this.initialised = false
    }

    get active()
    {
        const w = this.world
        return this.mode === 'chase' && !this.camera.targetOverride && !w.explorer?.firstPerson
            && w.arcade?.state === 'idle' && !w.interiors?.active
    }

    update(delta)
    {
        const w = this.world
        if(!this.active || !w.car)
        {
            this.initialised = false
            this.camera.fovKick.baseFov = w.explorer?.firstPerson ? 75 : 40
            return
        }
        const dt = Math.min(delta, 50) / 1000
        const onFoot = w.explorer?.active
        const p = onFoot ? w.explorer.renderPosition : w.car.chassis.object.position
        const heading = onFoot ? w.explorer.heading : w.explorer.renderCarHeading
        if(this.initialised && p.distanceToSquared(this.lastSubject) > 100) this.initialised = false
        this.lastSubject.copy(p)
        const speed = onFoot ? Math.hypot(w.explorer.body.velocity.x, w.explorer.body.velocity.y) : Math.abs(w.physics.car.speed) * 1000
        if(this.wasOnFoot === undefined) this.yaw = heading
        else if(onFoot !== this.wasOnFoot)
        {
            // Keep the entry view, then ease behind the subject. Explorer locks
            // held movement to its initial view basis so following cannot turn
            // a held lateral input into a spiral.
            this.yaw = w.controls.getViewYaw()
            this.orbit.yaw = 0
        }
        this.wasOnFoot = onFoot
        // Heading follows with a little lag so turns read on screen.
        const diff = Math.atan2(Math.sin(heading - this.yaw), Math.cos(heading - this.yaw))
        this.yaw += diff * (1 - Math.exp(-dt * (onFoot ? 5 : 3.2)))
        if(!this.orbit.drag)
        {
            this.orbit.idle += dt
            if(this.orbit.idle > 2.5 || speed > 6 || (onFoot && speed > .2 && this.orbit.idle > .6))
            {
                this.orbit.yaw *= Math.max(0, 1 - dt * 2.2)
                this.orbit.pitch *= Math.max(0, 1 - dt * 2.2)
            }
        }
        const yaw = this.yaw + this.orbit.yaw
        const flying = !onFoot && w.physics.car.hover?.airborne
        const distance = (onFoot ? 4.4 : flying ? 9 + Math.min(speed, 30) * 0.1 : 7.2 + Math.min(speed, 20) * 0.08) * this.distanceScale
        const height = (onFoot ? 1.9 : flying ? 3.2 : 2.6) + this.orbit.pitch * distance * 0.9 + (this.distanceScale - 1) * 1.5
        const lookAhead = onFoot ? 1.2 : 3 + Math.min(speed, 20) * 0.15
        this.target.set(p.x, p.y, p.z + (onFoot ? 1.5 : 1.1))
        this.desired.set(p.x - Math.cos(yaw) * distance, p.y - Math.sin(yaw) * distance, p.z + height)

        // Pull in when a tower or bridge sits between the subject and the camera.
        const toCam = this.toCam.copy(this.desired).sub(this.target)
        const full = toCam.length()
        this.ray.set(this.target, toCam.divideScalar(full))
        let nearest = full
        for(const box of this.colliders)
        {
            if(!this.ray.intersectBox(box, this.hit)) continue
            const t = this.hit.distanceTo(this.target)
            if(t < nearest) nearest = t
        }
        const pull = Math.max(0.12, (nearest - 0.6) / full)
        this.pull = pull < this.pull ? pull : this.pull + (pull - this.pull) * Math.min(1, dt * 2.5)
        this.desired.copy(this.target).addScaledVector(this.ray.direction, full * this.pull)
        this.desired.z = Math.max(this.desired.z, 0.8)

        const lookYaw = onFoot ? yaw : this.yaw
        const ahead = this.ahead.set(p.x + Math.cos(lookYaw) * lookAhead, p.y + Math.sin(lookYaw) * lookAhead, p.z + (onFoot ? 1.4 : 1.2))
        if(!this.initialised)
        {
            this.position.copy(this.desired)
            this.look.copy(ahead)
            this.initialised = true
        }
        const k = 1 - Math.exp(-dt * 7)
        this.position.lerp(this.desired, k)
        this.look.lerp(ahead, 1 - Math.exp(-dt * 9))
        this.instance.position.copy(this.position).add(this.camera.shake.offset)
        this.instance.up.set(0, 0, 1)
        this.instance.lookAt(this.look)
        this.camera.fovKick.baseFov = onFoot ? 60 : flying ? 66 : 62
        this.instance.updateMatrixWorld()
    }
}
