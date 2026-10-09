// Run after entering the city with ?guide=0, at desktop and mobile sizes.
(async () =>
{
    const w = window.application.world, e = w.explorer, guide = w.visitorGuide
    const frames = async count => { for(let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    const checks = []
    const check = (name, passed, detail) => checks.push({ name, passed: !!passed, detail })
    w.arcade.exit(); w.miniGames.destroy(); w.careerRPG.close(); guide.close(); guide.clear()
    if(innerWidth <= 768) window.dispatchEvent(new Event('touchstart'))
    if(e.firstPerson) e.toggleView()
    const car = w.physics.car.chassis.body
    for(const mode of ['driving', 'walking', 'skateboarding'])
    {
        e.enterCar(true); w.hoverFlight.forceLand()
        car.position.set(0, -30, .6); car.velocity.set(0, 0, 0)
        if(mode !== 'driving') { e.exitCar(); e.setSkating(mode === 'skateboarding') }
        const body = mode === 'driving' ? car : e.body
        body.position.set(0, -29, .6); body.velocity.set(0, 0, 0)
        await frames(3)
        guide.choose('projects', 2)
        let matches = 0, changes = 0, previous = null
        for(let i = 0; i < 36; i++)
        {
            body.position.set(i * .15, -29 + Math.sin(i * .2) * .15, .6)
            body.velocity.set(0, 0, 0); body.wakeUp()
            await frames(1)
            const p = e.renderPosition, matrix = guide.markers.instanceMatrix.array
            const target = guide.path[guide.waypoint]
            const yaw = Math.atan2(matrix[1], matrix[0]), desired = Math.atan2(target[1] - p.y, target[0] - p.x)
            const gap = Math.hypot(matrix[12] - p.x, matrix[13] - p.y)
            if(guide.markers.visible && Math.abs(gap - 2) < .02 && Math.cos(yaw - desired) > .999) matches++
            if(previous !== null && Math.abs(previous - matrix[12]) > .001) changes++
            previous = matrix[12]
        }
        check(`${mode}: arrows stay close and point along the current route`, matches >= 32, { matches, frames: 36 })
        check(`${mode}: trail moves smoothly rather than waiting 250 ms`, changes >= 30, { changes })
    }
    e.enterCar(true); w.hoverFlight.forceLand()
    car.position.set(0, -30, .6); car.velocity.set(0, 0, 0)
    await frames(3); guide.choose('projects', 2)
    car.position.set(20, -40, .6); car.velocity.set(0, 0, 0)
    await frames(3)
    check('Off-route movement replans from the current position', Math.abs(guide.path[0][0] - 20) < .1 && guide.path[0][1] < -39)
    car.position.set(0, -30, .6); car.velocity.set(0, 0, 0)
    await frames(3); guide.choose('projects', 2)
    car.position.set(guide.destination.x + 5, -30, .6); car.velocity.set(0, 0, 0)
    await frames(3)
    check('Overshooting an avenue turn advances toward the destination column', guide.path[guide.waypoint][1] === guide.destination.y)
    w.hoverFlight.takeOff(); w.hoverFlight.mode = 'flying'
    car.position.set(0, -30, 40); car.velocity.set(0, 0, 0)
    await frames(3)
    const p = e.renderPosition, matrix = guide.markers.instanceMatrix.array
    check('Flying keeps a visible direct trail at the player’s altitude', guide.markers.visible && Math.abs(matrix[14] - (p.z - .75)) < .01 && Math.cos(Math.atan2(matrix[1], matrix[0]) - Math.atan2(guide.destination.y - p.y, guide.destination.x - p.x)) > .999)
    check('Trail still uses one bounded instanced batch', guide.markers.isInstancedMesh && guide.markers.count <= 28 && guide.markers.geometry.index.count === 12)
    w.hoverFlight.forceLand(); car.position.set(guide.destination.x, guide.destination.y, .6); car.velocity.set(0, 0, 0)
    await frames(4)
    check('Arrival clears the arrows without hiding the information card', !guide.markers.visible && !guide.$route.hidden)
    guide.clear(); w.guidedTour.clearControls()
    return { passed: checks.every(c => c.passed), viewport: [innerWidth, innerHeight], checks }
})()
