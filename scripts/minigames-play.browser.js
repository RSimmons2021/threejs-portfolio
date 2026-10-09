// Deterministic gameplay checks: exercise real game rules/inputs and assets,
// without the director's debug pass/fail hook. No wall-clock game waits.
(async () => {
    const w = application.world, m = w.miniGames, r = w.careerRPG
    const results = [], check = (name, ok) => { if(!ok) throw Error(name); results.push(name) }
    const start = async id => {
        r.close(); m.destroy(); m.start(id, () => {})
        const deadline = performance.now() + 15000
        while(m.state !== 'ready') { if(performance.now() > deadline) throw Error('Game did not become ready'); await new Promise(requestAnimationFrame) }
        let draws = 0
        m.root.traverse(mesh => { if(mesh.isMesh) draws++ })
        check(`${id} adds at most 25 draws`, draws <= 25)
        m.begin(); m.countdown = 0; m.update()
    }
    await start('beatTunnel')
    const beat = m.game
    for(let i = 0; i < beat.spec.rings.length; i++) {
        const pattern = beat.pattern[i % 8]
        beat.offset.set(...pattern); beat.drag(pattern[0] * 50, -pattern[1] * 50)
        m.elapsed = (i + 1) * beat.period + 0.000001
        if(beat.spec.rings[i].kind === 'gate') beat.action('Space')
        beat.update(0)
    }
    check('Beat Tunnel scores every authored ring and all boost gates', m.result?.passed && m.result.medal === 'gold' && beat.hits === 58 && beat.gatesHit === 3)
    m.destroy()
    await start('packetRun')
    const packets = m.game, car = w.physics.car.chassis.body
    packets.spawnTimer = 200
    for(let i = 0; i < 12; i++) {
        packets.live = Array.from({ length: 3 }, () => ({ p: [-30, -30, 45], ttl: 12 }))
        car.position.set(-30, -30, 45); packets.update(0)
        check(`Packet pickup ${i} respects 3-slot capacity`, packets.carry === 3)
        car.position.set(...packets.spec.racks[i % 3].intakeRing)
        packets.update(0)
        packets.state.loads = [0, 0, 0]
    }
    m.elapsed = packets.duration; packets.update(0)
    check('Packet Run actually serves >1M and passes', m.result?.passed && packets.state.served === 36 && packets.carry === 0)
    m.destroy()
    await start('handoff')
    const handoff = m.game
    for(let i = 0; i < 50; i++) {
        const item = handoff.item, threshold = { HIGH: 92, MED: 80, LOW: 60 }[item.stakes]
        handoff.action(item.mismatch || item.confidence < threshold ? 'ArrowLeft' : 'ArrowRight')
    }
    m.elapsed = 90; handoff.update(0)
    check('Handoff actual routing validates 500 docs without harm', m.result?.passed && handoff.strikes === 0)
    m.destroy()
    await start('shipIt')
    const ship = m.game, walker = w.explorer.body
    const work = (station, seconds) => {
        const s = ship.stations.find(s => s.name === station)
        walker.position.set(540 + s.p[0], 320 + s.p[1], 0.65)
        m.keys.add('KeyE')
        for(let t = 0; t < seconds; t += 0.05) { m.elapsed += 0.05; ship.update(0.05) }
        m.keys.delete('KeyE')
    }
    for(let i = 0; i < 2; i++) {
        const app = ship.apps[i]
        walker.position.set(540 + app.p[0], 320 + app.p[1], 0.65); ship.update(0)
        check(`Ship It picks up ${app.name}`, ship.carry === i)
        work('CODE', 3.05); work('BUILD iOS', 1.55); work('BUILD ANDROID', 1.55)
        if(i === 0) {
            ship.payments = 1; work('REVIEW', 1.55)
            check('Unresolved payment produces a fixable rejection', app.phase === 'fix' && app.rejections === 1)
            work('PAYMENTS', 1.55); work('CODE', 3.05); work('BUILD iOS', 1.55); work('BUILD ANDROID', 1.55)
        }
        work('REVIEW', 1.55)
        for(let retry = 0; app.phase === 'fix' && retry < 3; retry++) {
            work('CODE', 3.05); work('BUILD iOS', 1.55); work('BUILD ANDROID', 1.55); work('PAYMENTS', 1.55); work('REVIEW', 1.55)
        }
        check(`Ship It ships ${app.name} through both builds and review`, app.phase === 'shipped')
    }
    check('Ship It earns a real two-app result', m.result?.passed)
    m.destroy()
    // On-foot / first-person return and mobile held-button cancellation.
    r.close(); w.hoverFlight.forceLand()
    if(!w.explorer.active) w.explorer.exitCar()
    if(!w.explorer.firstPerson) w.explorer.toggleView()
    const pose = w.explorer.body.position.clone()
    await start('shipIt')
    const button = m.$actions.querySelector('button')
    button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }))
    m.pause()
    check('Blur/pause clears held mobile keys', m.keys.size === 0)
    m.destroy()
    check('On-foot first-person pose is restored', w.explorer.active && w.explorer.firstPerson && w.explorer.body.position.distanceTo(pose) < 0.1)
    if(w.explorer.firstPerson) w.explorer.toggleView()
    w.explorer.enterCar(true)
    check('Game buffers and input ownership are released', !m.active && !w.physics.car.miniGameOwnsPose && !w.experienceDirector.locks.has('minigame'))
    return results
})()
