// Run on the welcome screen, then it enters through the real start button.
(async () =>
{
    const app = window.application, w = app.world, results = [], metrics = {}
    const check = (label, ok) => { if(!ok) throw new Error(label); results.push(label) }
    const frames = async (count, inspect = () => {}) =>
    {
        for(let i = 0; i < count; i++) { await new Promise(requestAnimationFrame); inspect() }
    }
    const key = (code, down) => document.body.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }))
    window.validationErrors = []
    window.addEventListener('error', e => window.validationErrors.push(e.message))
    const oldError = console.error
    console.error = (...a) => { window.validationErrors.push(a.map(String).join(' ')); oldError(...a) }
    if(!w.started) document.querySelector('.js-city-start').click()
    await frames(180, () => { metrics.introShake = Math.max(metrics.introShake || 0, app.camera.shake.intensity) })
    check('Intro descent has no impact shake', metrics.introShake === 0)
    check('Intro sound is not registered', !w.sounds.items.some(s => s.name === 'reveal'))
    const e = w.explorer, body = w.physics.car.chassis.body
    w.cameraRig.mode = 'chase'; w.cameraRig.applyMode()
    if(e.firstPerson) e.toggleView()
    e.exitCar()
    check('Walker exits the car', e.active)
    e.body.position.set(3, -28, 0.4)
    await frames(50)
    for(const skate of [false, true])
    {
        e.setSkating(skate)
        const start = e.body.position.clone(), camStart = app.camera.instance.position.clone()
        key('KeyW', true); await frames(45); key('KeyW', false); await frames(35)
        const travel = e.body.position.distanceTo(start), follow = app.camera.instance.position.distanceTo(camStart)
        check(`${skate ? 'Skateboard' : 'Walking'} moves`, travel > 0.5)
        check(`${skate ? 'Skateboard' : 'Walking'} follow camera tracks the player`, follow > travel * 0.6 && follow < travel * 1.4)
        check('Follow camera owns the final render pose', app.camera.instance.position.distanceTo(w.cameraRig.position) < 0.001)
    }
    e.setSkating(false); e.enterCar(true); e.toggleView()
    let peak = 0
    const eye = () =>
    {
        const expected = e.cockpitEye.clone().fromArray(w.resources.items.hoverCarSpec.cockpit.eye.meshFrame).applyQuaternion(w.car.chassis.object.quaternion).add(w.car.chassis.object.position)
        peak = Math.max(peak, app.camera.instance.position.distanceTo(expected))
    }
    key('KeyW', true); await frames(70, eye); key('KeyW', false)
    check('Driving first-person eye remains fixed to the rendered cockpit', peak < 1e-6)
    app.camera.shake.trigger(20)
    check('First-person ignores collision shake', app.camera.shake.intensity === 0)
    w.hoverFlight.takeOff(); await frames(65)
    body.position.z = 20; body.velocity.set(0, 0, 0)
    key('KeyW', true); key('KeyA', true); peak = 0
    await frames(70, eye); key('KeyW', false); key('KeyA', false)
    check('Flying/turning first-person eye remains fixed to the rendered cockpit', peak < 1e-6)
    check('Hover loop is loaded and playing', w.sounds.flight.hover.sound.state() === 'loaded' && w.sounds.flight.hover.id !== null)
    check('Flying suppresses the road motor', w.sounds.flight.mix.drive < 0.02)
    metrics.cockpitEyeDrift = peak
    w.hoverFlight.forceLand(); body.position.set(0, -30, 0.5); body.velocity.set(0, 0, 0)
    await frames(60)
    e.toggleView(); e.exitCar()
    w.interiors.enter(w.careerRPG.doors.get('homelab').building)
    await frames(45)
    check('Apartment uses the cyberpunk shell', !!w.interiors.room.getObjectByName('apt_shell'))
    check('Apartment window has the supplied city-view texture', !!w.interiors.room.getObjectByName('apt_window').material.map)
    check('Apartment furniture keeps atlas color and local light', !!w.interiors.room.getObjectByName('apt_furniture_warm').material.uniforms.uRoomOrigin)
    check('Apartment is visible in first person', w.interiors.room.visible && e.firstPerson && !e.blocked)
    check('Closed apartment door has collision', w.interiors.bodies.some(b => Math.abs(b.position.y - 316.45) < 0.01 && b.shapes[0].halfExtents.x > 4))
    check('Apartment stations remain available', w.interiors.stations.length === 3)
    w.interiors.leave(); await frames(30)
    check('Leaving hides the distant interior', !w.interiors.room.visible && !w.interiors.active)
    check('No browser errors', window.validationErrors.length === 0)
    return { passed: results.length, results, metrics }
})()
