// Run after entering the Neon District. Checks real door entry/rewards and
// teardown for every game, plus genuine input/scoring (not just debug wins).
(async () => {
    const w = application.world, r = w.careerRPG, m = w.miniGames, e = w.explorer
    const results = []
    const check = (name, ok) => { if(!ok) throw Error(name); results.push(name) }
    const wait = async predicate => {
        const deadline = performance.now() + 15000
        while(!predicate()) { if(performance.now() > deadline) throw Error('Arena readiness timed out'); await new Promise(requestAnimationFrame) }
    }
    const data = await import('/javascript/World/careerData.js')
    const setup = () => { r.close(); r.reset(); r.state.stats = { ai: 5, systems: 5, product: 5 }; r.state.focus = 100; r.state.hour = 8; r.syncDoorLocks() }
    const entries = [
        ['packetRun', 'gym', '[data-train]', 'systems', data.HOURS_TRAIN],
        ['beatTunnel', 'signal', '[data-train]', 'product', data.HOURS_TRAIN],
        ['signalNoise', 'wright', '[data-train]', 'ai', data.HOURS_TRAIN],
        ['containment', 'cabinet', '[data-play]', 'ai', data.HOURS_ARCADE],
        ['handoff', 'loopp', '[data-shift="loopp-handoff"]', null, data.HOURS_SHIFT],
        ['shipIt', 'zoan', '[data-shift="zoan-ship"]', null, data.HOURS_SHIFT]
    ]
    for(const [id, door, selector, stat, hours] of entries) {
        for(const passed of [false, true]) {
            setup()
            const building = r.doors.get(door).building
            r.open(building)
            const carPose = w.physics.car.chassis.body.position.clone()
            const onFoot = e.active
            const before = { credits: r.state.credits, focus: r.state.focus, hour: r.state.hour, stats: { ...r.state.stats } }
            r.$dialog.querySelector(selector).click()
            await wait(() => m.state === 'ready')
            check(`${id} enters through ${door}`, m.active === id && !r.$dialog.open && w.experienceDirector.locks.has('minigame'))
            check(`${id} uses Blender assets`, m.root.children.length > 0)
            m.begin(); m.countdown = 0; m.update()
            check(`${id} countdown starts play`, m.state === 'playing')
            m.pause(); const elapsed = m.elapsed; m.update()
            check(`${id} pauses without advancing`, m.state === 'paused' && m.elapsed === elapsed)
            m.$actions.querySelector('button').click()
            m.debug.resolve(passed)
            check(`${id} resolves ${passed ? 'pass' : 'fail'} and reopens career`, !m.active && r.$dialog.open)
            check(`${id} hours unchanged`, r.state.hour === before.hour + hours)
            const focus = stat && id !== 'containment' ? building.trainer.focus : id === 'handoff' ? building.shifts.find(s => s.id === 'loopp-handoff').focus : id === 'shipIt' ? building.shifts.find(s => s.id === 'zoan-ship').focus : 0
            check(`${id} focus unchanged`, r.state.focus === before.focus - focus)
            const payout = id === 'containment' ? 60 : stat ? 25 : building.shifts.find(s => s.id === (id === 'handoff' ? 'loopp-handoff' : 'zoan-ship')).credits
            check(`${id} rewards only on pass`, r.state.credits === before.credits + (passed ? payout : 0))
            m.debug.resolve(true)
            check(`${id} callback cannot reward twice`, r.state.credits === before.credits + (passed ? payout : 0))
            check(`${id} restores car and walker mode`, e.active === onFoot && w.physics.car.chassis.body.position.distanceTo(carPose) < 0.1)
            r.close()
            check(`${id} exit releases all locks`, !e.blocked && !w.experienceDirector.locks.has('minigame') && w.hoverFlight.mode === 'grounded')
        }
    }
    // Exercise actual keyboard/touch-style inputs against the live 3D game.
    setup(); r.open(r.doors.get('cabinet').building); r.$dialog.querySelector('[data-play]').click(); await wait(() => m.state === 'ready')
    m.begin(); m.countdown = 0; m.update()
    for(let i = 0; i < 30; i++) m.$actions.querySelectorAll('button')[m.game.item.verdict === 'auto' ? 0 : 1].click()
    check('Containment live touch buttons clear 30 real cases', m.state === 'result' && m.result.passed)
    m.complete(); r.close()
    setup(); r.open(r.doors.get('wright').building); r.$dialog.querySelector('[data-train]').click(); await wait(() => m.state === 'ready')
    m.begin(); m.countdown = 0; m.update()
    for(let i = 0; i < 50; i++) {
        const code = { positive: 'KeyA', neutral: 'KeyS', negative: 'KeyD' }[m.game.post.truth]
        window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }))
        window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }))
    }
    check('Signal / Noise actual keyboard sorts 50 atlas posts', m.state === 'result' && m.result.medal === 'gold')
    m.complete(); r.close()
    setup(); r.open(r.doors.get('gym').building); r.$dialog.querySelector('[data-train]').click(); await wait(() => m.state === 'ready')
    m.begin(); m.countdown = 0; m.update()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true })); m.update()
    check('Packet Run controls move the flight chassis', w.physics.car.chassis.body.velocity.x > 0)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))
    check('Escape cancels without rewards or stuck controls', !m.active && !r.$dialog.open && !e.blocked && !w.controls.actions.up)
    check('Mini-game buffers leave the scene on exit', !w.container.children.some(c => c.name.startsWith('3D mini-game')))
    check('New crowd is one noncolliding draw', w.neonCrowd.ready && w.neonCrowd.mesh.isInstancedMesh && !w.physics.world.bodies.some(b => b.collisionRole === 'npc'))
    check('Holo gallery contains all 18 panels', w.neonProjects.panels.length === 18)
    check('Project floor zones keep their destinations', w.sections.projects.items.every(p => p.link.href && p.floor.area.active))
    r.reset()
    return results
})()
