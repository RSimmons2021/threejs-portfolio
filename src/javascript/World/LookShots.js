// Dev-only look review: ?shot=<name> parks the hover car at a fixed pose and
// hides the HUD so before/after captures of the lighting compare like for like.
//   street  default spawn, on the road
//   canyon  low flight between the towers
//   aerial  high over the district, looking along it
//   drop    looking down into a street canyon
//   avenue  parked on the road down a long street (ground-level twin of canyon)
//   horizon above the rooftops, looking across the district into the sky
export const SHOTS = Object.freeze({
    street: null,
    canyon: { p: [18, -6, 14], yaw: 0, pitch: 0 },
    aerial: { p: [-60, -30, 48], yaw: 0.25, pitch: 0.55 },
    drop: { p: [40, -10, 40], yaw: 0, pitch: 0.9 },
    avenue: { p: [36, -30, 0.7], yaw: 0, pitch: -0.05, ground: true },
    horizon: { p: [-40, -32, 58], yaw: 0.1, pitch: -0.2 }
})

export function shotFromSearch(search)
{
    const name = new URLSearchParams(search).get('shot')
    return name && Object.hasOwn(SHOTS, name) ? name : null
}

export default class LookShots
{
    constructor(world, name)
    {
        this.world = world
        this.name = name
        this.pose = SHOTS[name]
        document.body.classList.add('is-look-review')
        // Wait for the reveal and the walker/car hand-off, then hold the pose.
        this.started = world.time.elapsed
        world.time.on('tick', () => this.update())
    }

    update()
    {
        const w = this.world
        if(!this.pose || !w.hoverFlight || w.time.elapsed - this.started < 2500) return
        const body = w.physics.car.chassis.body
        if(this.pose.ground)
        {
            // Place once on the road and let the suspension settle.
            if(!this.placed)
            {
                body.position.set(...this.pose.p)
                body.quaternion.setFromAxisAngle({ x: 0, y: 0, z: 1 }, this.pose.yaw)
                this.placed = true
            }
            body.velocity.set(0, 0, 0)
            body.angularVelocity.set(0, 0, 0)
        }
        else
        {
            if(!w.hoverFlight.airborne) w.hoverFlight.takeOff(true)
            if(w.hoverFlight.mode === 'takeoff') w.hoverFlight.mode = 'flying'
            body.position.set(...this.pose.p)
            body.velocity.set(0, 0, 0)
            w.hoverFlight.yaw = this.pose.yaw
        }
        if(!this.logged && w.time.elapsed - this.started > 6000)
        {
            // The capture tooling reads this line to tie a frame to its lighting state.
            this.logged = true
            const u = w.materials.cyber.shared, f = (v) => v.toArray().map(n => +n.toFixed(3))
            console.info('look-review', JSON.stringify({ shot: this.name, time: +w.dayNightCycle.settings.currentTime.toFixed(4),
                daylight: +u.uDaylight.value.toFixed(3), sun: f(u.uSunColor.value), sunDir: f(u.uSunDir.value),
                sky: f(u.uSkyColor.value), fog: +u.uFogDensity.value.toFixed(5), cloud: +u.uCloudCover.value.toFixed(2),
                tier: w.quality?.tier }))
        }
        if(w.cameraRig)
        {
            w.cameraRig.orbit.pitch = this.pose.pitch
            w.cameraRig.orbit.yaw = 0
            w.cameraRig.orbit.idle = 0
            w.cameraRig.orbit.drag = { id: -1 }
        }
    }
}
