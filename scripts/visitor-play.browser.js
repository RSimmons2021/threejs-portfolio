// Run after entering the district. Never uses the debug pass/fail resolver.
(async () =>
{
    const w = application.world, m = w.miniGames, r = w.careerRPG, body = w.physics.car.chassis.body
    const results = [], check = (label, ok) => { if(!ok) throw Error(label); results.push(label) }
    const frames = async count => { for(let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    const wait = async predicate =>
    {
        const deadline = performance.now() + 15000
        while(!predicate()) { if(performance.now() > deadline) throw Error('Readiness timeout'); await new Promise(requestAnimationFrame) }
    }
    r.close(); m.destroy(); r.reset()
    check('New visitor receives 300 starter credits', r.state.credits === 300)
    const stored = r.read()
    check('Reloading the save does not duplicate the grant', stored.credits === 300 && stored.starterCreditsGranted)
    w.hoverFlight.forceLand()
    if(w.explorer.active) w.explorer.enterCar(true)
    body.position.set(-30, -34, 0.6); body.velocity.set(0, 0, 0)
    r.state.focus = 0; r.state.hour = 24; r.save()
    await frames(5)
    check('All six practice games are discoverable in the arcade', !w.arcade.$panel.hidden && [...w.arcade.$panel.querySelectorAll('[data-practice]')].length === 6)
    const initial = JSON.stringify(r.state)
    for(const id of ['packetRun', 'beatTunnel', 'signalNoise', 'handoff', 'containment', 'shipIt'])
    {
        w.arcade.$panel.querySelector(`[data-practice="${id}"]`).click()
        await wait(() => m.state === 'ready')
        check(`${id} free practice opens with zero focus, zero stats and an exhausted day`, m.active === id && m.practice)
        check(`${id} practice does not charge career resources`, JSON.stringify(r.state) === initial)
        let draws = 0
        m.root.traverse(node => { if(node.isMesh || node.isSprite) draws++ })
        check(`${id} stays within the 25 added-draw budget`, draws <= 25)
        m.destroy()
    }
    // Begin a real flying route. Use held gameplay inputs and the real Cannon
    // world, accelerated fixed steps, not teleports to score locations.
    w.arcade.$panel.querySelector('[data-practice="packetRun"]').click()
    await wait(() => m.state === 'ready')
    m.begin(); m.countdown = 0; m.update()
    const game = m.game
    check('Delivery markers exist at all three intake centres', game.deliveryMarkers?.count === 3)
    const loaded = []
    for(let step = 0; step < game.duration * 60 + 1 && m.state === 'playing'; step++)
    {
        const target = game.target, p = body.position
        const desired = Math.atan2(target[1] - p.y, target[0] - p.x)
        const error = Math.atan2(Math.sin(desired - game.yaw), Math.cos(desired - game.yaw))
        const planar = Math.hypot(target[0] - p.x, target[1] - p.y)
        m.keys.clear()
        if(Math.abs(error) > 0.035) m.keys.add(error > 0 ? 'KeyA' : 'KeyD')
        if(planar > 0.75 && Math.abs(error) < 0.7) m.keys.add('KeyW')
        if(target[2] - p.z > 0.75) m.keys.add('KeyE')
        if(target[2] - p.z < -0.75) m.keys.add('KeyQ')
        const before = game.carry
        m.elapsed += 1 / 60; game.update(1 / 60)
        w.physics.world.step(1 / 60)
        if(game.carry > before) loaded.push({ step, carry: game.carry })
    }
    m.keys.clear()
    check('Actual flight controls collect cargo', loaded.length > 0)
    check('Actual flight controls deliver cargo to a rack', game.state.served >= 3)
    check('Packet Run is winnable via its real flight loop', m.result?.passed && game.state.served >= 34 && game.drop < 6)
    check('Practice completion never grants career rewards', JSON.stringify(r.state) === initial)
    const route = { served: game.state.served, dropped: game.drop, pickups: loaded.length, medal: m.result.medal }
    m.$actions.querySelector('button').click()
    await wait(() => m.state === 'ready')
    check('Free practice has a working immediate replay', m.active === 'packetRun' && m.practice)
    m.destroy()
    r.reset()
    body.position.set(0, -30, 0.6); body.velocity.set(0, 0, 0)
    w.hoverFlight.takeOff(); w.hoverFlight.mode = 'flying'
    body.position.set(0, -30, 100); body.velocity.set(0, 0, 0)
    w.hoverFlight.keys.climb = true
    for(let i = 0; i < 600; i++) w.physics.world.step(1 / 60)
    check('Free-flight climb passes the old 70m ceiling', body.position.z > 145)
    for(let i = 0; i < 600; i++) w.physics.world.step(1 / 60)
    check('Free flight eases into a safe 160m ceiling', body.position.z > 159 && body.position.z < 161)
    w.hoverFlight.keys.climb = false
    await frames(45)
    check('Very subtle hover wind is loaded and running', w.sounds.flight.air.id !== null && w.sounds.flight.mix.air > 0 && w.sounds.flight.mix.air <= 0.07)
    check('Quiet city ambience is loaded and running', w.sounds.flight.city.id !== null && w.sounds.flight.city.sound.volume(w.sounds.flight.city.id) <= 0.06)
    w.hoverFlight.forceLand()
    body.position.set(0, -30, 0.6); body.velocity.set(0, 0, 0)
    await frames(30)
    return { passed: results.length, results, route }
})()
