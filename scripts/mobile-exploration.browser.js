// Run after entering the city at a mobile viewport. Also drives actual Cannon
// contacts after the fixture checks, so render-only collisions cannot pass.
(async () =>
{
    const w = window.application.world, e = w.explorer, c = w.controls, checks = []
    const frames = async count => { for(let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    const check = (name, passed, detail) => checks.push({ name, passed: !!passed, detail })
    w.visitorGuide.close(); w.visitorGuide.clear(); w.arcade.exit(); w.careerRPG.close()
    if(e.firstPerson) e.toggleView()
    e.enterCar(true); w.hoverFlight.forceLand(); w.guidedTour.clearControls()
    const car = w.physics.car.chassis.body
    car.position.set(0,-30,.6); car.velocity.set(0,0,0); car.angularVelocity.set(0,0,0); car.quaternion.setFromEuler(0,0,0)
    w.cameraRig.mode = 'chase'; w.cameraRig.applyMode()
    await frames(10); e.exitCar()
    for(const skating of [false, true])
    {
        e.setSkating(skating)
        c.actions.right = true
        const start = e.body.position.clone()
        await frames(100)
        const p = e.renderPosition, cam = w.camera.instance.position
        const behind = (cam.x-p.x)*Math.cos(e.heading)+(cam.y-p.y)*Math.sin(e.heading)
        check(`${skating ? 'Skateboard' : 'Walking'} chase camera stays behind the character`, behind < -2, { behind })
        const dx = e.body.position.x-start.x, dy = e.body.position.y-start.y
        check('Held lateral movement does not spiral as the chase camera turns', Math.hypot(dx,dy) > (skating ? 7 : 3), { dx, dy })
        c.actions.right = false; await frames(20)
    }
    e.setSkating(false)
    const touch = new Touch({ identifier: 99, target: document.body, clientX: 1, clientY: 1 })
    window.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch], touches: [touch] }))
    window.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], touches: [] }))
    c.touch.boost.events.touchstart({ preventDefault() {}, changedTouches: [{ identifier: 42 }] })
    c.touch.boost.events.touchend({ changedTouches: [{ identifier: 42 }] })
    check('Mobile boost/sprint action toggles the skateboard on foot', e.skating && !c.actions.boost && !c.actions.up)
    check('Mobile board action is a labeled keyboard-accessible button', c.touch.boost.$element.tagName === 'BUTTON' && /skateboard|walk/i.test(c.touch.boost.$element.getAttribute('aria-label')))
    e.setSkating(false)
    const career = w.careerRPG.$panel.getBoundingClientRect()
    check('Optional career card starts compact on mobile', career.height <= 110, { height: career.height })
    const boards = w.physics.world.bodies.filter(body => body.collisionRole === 'project-board')
    check('All eighteen project kiosks have real physics collision bodies', boards.length >= 18, { bodies: boards.length })
    if(boards.length)
    {
        const board = boards[0], savedPosition = e.body.position.clone(), savedVelocity = e.body.velocity.clone()
        board.computeAABB()
        const bounds = board.aabb
        let contacts = 0
        const onContact = event => { if(event.body === board) contacts++ }
        w.time.stop()
        try
        {
            e.body.addEventListener('collide', onContact)
            e.body.position.set(board.position.x, bounds.lowerBound.y - 2, Math.max(.6, bounds.lowerBound.z + .6))
            e.body.wakeUp()
            for(let i = 0; i < 40; i++) { e.body.velocity.set(0,6,0); w.physics.world.step(1 / 60) }
            check('A walking physics body cannot pass through a project billboard', contacts > 0 && e.body.position.y < bounds.lowerBound.y, { contacts })
        }
        finally { e.body.removeEventListener('collide', onContact); e.body.position.copy(savedPosition); e.body.velocity.copy(savedVelocity); w.time.resume() }
    }
    w.dayNightCycle.settings.realTime = false; w.dayNightCycle.settings.currentTime = 23/24; w.dayNightCycle.update()
    await frames(20)
    check('Yellow rear glow is removed without disabling under-car lighting', !w.car.backLightsReverse.glow || !w.car.backLightsReverse.glow.visible || w.car.backLightsReverse.glow.material.opacity === 0)
    e.body.position.set(-22,-43,.6); e.body.velocity.set(0,0,0)
    w.arcade.dismissed = false
    await frames(20)
    const arcade = w.arcade.$panel.getBoundingClientRect()
    check('Mobile arcade invitation starts compact', !w.arcade.$panel.hidden && arcade.height <= 130, { height: arcade.height })
    const toggle = w.arcade.$panel.querySelector('[data-action="menu-toggle"]')
    toggle.focus(); toggle.click()
    check('Arcade expands into eight playable choices on request', !w.arcade.$menu.hidden && w.arcade.$menu.querySelectorAll('[data-game], [data-practice]').length === 8 && document.activeElement === toggle)
    toggle.click()
    e.body.position.set(0,-29,.6); e.body.velocity.set(0,0,0)
    await frames(20)
    check('Leaving the arcade closes its menu and restores the compact career strip', w.arcade.$panel.hidden && !w.arcade.menuExpanded && !document.body.classList.contains('has-arcade-invitation') && w.careerRPG.$panel.getBoundingClientRect().height > 0)
    w.guidedTour.clearControls(); e.enterCar(true)
    return { passed: checks.every(c => c.passed), viewport: [innerWidth, innerHeight], checks }
})()
