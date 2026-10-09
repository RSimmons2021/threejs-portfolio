// Run after entering the city with ?guide=0, at desktop and mobile sizes.
(async () =>
{
    const w = window.application.world, e = w.explorer, guide = w.visitorGuide
    // Mobile caps rendering at 60 Hz even if the browser sends faster RAFs.
    // Observe actual site frames, not skipped callbacks with unchanged poses.
    const frames = async count =>
    {
        for(let i = 0; i < count; i++)
        {
            const previous = w.time.current
            do { await new Promise(requestAnimationFrame) } while(w.time.current === previous)
        }
    }
    const checks = []
    const check = (name, passed, detail) => checks.push({ name, passed: !!passed, detail })
    w.arcade.exit(); w.miniGames.destroy(); w.careerRPG.close(); guide.close(); guide.clear()
    if(innerWidth <= 768)
    {
        const touch = new Touch({ identifier: 99, target: document.body, clientX: 1, clientY: 1 })
        window.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch], touches: [touch] }))
        window.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], touches: [] }))
    }
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
        let matches = 0, changes = 0, previous = null, anchoredChecks = 0, anchoredMatches = 0
        const fixed = new Map(), geometryVersion = guide.ribbon.geometry.attributes.position.version
        for(let i = 0; i < 36; i++)
        {
            body.position.set(i * .15, -29 + Math.sin(i * .2) * .15, .6)
            body.velocity.set(0, 0, 0); body.wakeUp()
            await frames(1)
            const p = e.renderPosition, matrix = guide.markers.instanceMatrix.array
            const target = guide.trail.leadTarget
            const yaw = Math.atan2(matrix[1], matrix[0]), desired = Math.atan2(target.y - p.y, target.x - p.x)
            const gap = Math.hypot(matrix[12] - p.x, matrix[13] - p.y)
            if(guide.markers.visible && Math.abs(gap - 2) < .02 && Math.cos(yaw - desired) > .995) matches++
            if(previous !== null && Math.abs(previous - matrix[12]) > .001) changes++
            previous = matrix[12]
            for(let index = 1; index < guide.markers.count; index++)
            {
                const key = guide.markers.geometry.attributes.guideDistance.getX(index)
                const values = Array.from(matrix.slice(index * 16, index * 16 + 16))
                if(fixed.has(key))
                {
                    anchoredChecks++
                    if(fixed.get(key).every((v, i) => Math.abs(v - values[i]) < .0001)) anchoredMatches++
                }
                fixed.set(key, values)
            }
        }
        check(`${mode}: arrows stay close and point along the current route`, matches >= 32, { matches, frames: 36 })
        check(`${mode}: trail moves smoothly rather than waiting 250 ms`, changes >= 30, { changes })
        check(`${mode}: farther chevrons and ribbon stay street-anchored`, anchoredChecks > 30 && anchoredMatches === anchoredChecks && guide.ribbon.geometry.attributes.position.version === geometryVersion, { anchoredChecks, anchoredMatches })
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
    // Let the existing shortest-arc damping settle after this artificial
    // teleport from the overshot turn; real flight does not jump 80 metres.
    for(let i = 0; i < 30; i++) { car.position.set(0, -30, 40); car.velocity.set(0, 0, 0); await frames(1) }
    const p = e.renderPosition, matrix = guide.markers.instanceMatrix.array
    check('Flying keeps a visible direct trail at the player’s altitude', guide.markers.visible && Math.abs(matrix[14] - (p.z - .75)) < .01 && Math.cos(Math.atan2(matrix[1], matrix[0]) - Math.atan2(guide.destination.y - p.y, guide.destination.x - p.x)) > .999)
    check('Trail uses two small bounded batches without lights', guide.container.children.length === 2 && guide.markers.isInstancedMesh && guide.markers.count <= 16 && guide.markers.geometry.index.count === 12 && guide.ribbon.geometry.attributes.position.count === 128)
    car.position.set(guide.destination.x, guide.destination.y, 40); car.velocity.set(0, 0, 0)
    for(let i = 0; i < 30; i++) { car.position.set(guide.destination.x, guide.destination.y, 40); car.velocity.set(0, 0, 0); await frames(1) }
    check('Above the destination the lead points down and guidance stays visible', guide.markers.visible && guide.ribbon.visible && guide.markers.instanceMatrix.array[2] < -.9 && !guide.$direction.textContent.startsWith('You’re here'))
    w.hoverFlight.forceLand(); car.position.set(guide.destination.x, guide.destination.y, .6); car.velocity.set(0, 0, 0)
    await frames(4)
    check('Arrival clears the arrows without hiding the information card', !guide.markers.visible && !guide.$route.hidden)
    guide.choose('projects', 2); await frames(3)
    if(guide.compactQuery.matches)
    {
        const collapsed = guide.$route.getBoundingClientRect()
        check('Compact guide keeps the route visible without a large mobile card', guide.$details.hidden && collapsed.height <= 130 && collapsed.right <= innerWidth && collapsed.bottom <= innerHeight)
        guide.$detailsToggle.focus(); guide.$detailsToggle.click(); await frames(2)
        check('Details disclosure keeps keyboard focus and reveals direct project actions', !guide.$details.hidden && guide.$detailsToggle.getAttribute('aria-expanded') === 'true' && document.activeElement === guide.$detailsToggle && guide.$read.getBoundingClientRect().height >= 44)
        guide.$detailsToggle.click(); await frames(2)
    }
    else check('Desktop keeps direct project actions visible', !guide.$details.hidden)
    check('Existing direction copy is retained without turn-by-turn instructions', !/Turn (left|right) in/.test(guide.$direction.textContent))
    const previousReducedMotion = w.config.reducedMotion
    w.config.reducedMotion = true
    car.position.set(0, -30, .6); car.velocity.set(0,0,0)
    await frames(3); guide.choose('play'); await frames(3)
    check('Optional games retain violet and the reduced-motion lead still navigates', guide.markerMaterial.color.getHexString() === 'e8a6ff' && Number.isFinite(guide.trail.leadYaw) && guide.markers.visible)
    w.config.reducedMotion = previousReducedMotion
    guide.clear(); w.guidedTour.clearControls()
    check('Clearing the destination removes both route batches', !guide.markers.visible && !guide.ribbon.visible)
    return { passed: checks.every(c => c.passed), viewport: [innerWidth, innerHeight], checks }
})()
