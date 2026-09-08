// Run after entering the site:
// npx agent-browser --session explorer eval --stdin < scripts/explorer.browser.js
(() => {
    const w = window.application.world
    const e = w.explorer
    const car = w.physics.car.chassis.body
    const results = []
    const check = (name, condition) => { if(!condition) throw new Error(name); results.push(name) }
    e.enterCar(true)
    w.arcade.exit(false)
    car.position.set(0, -15, 0.4)
    car.velocity.set(0, 0, 0)
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }))
    check('Exit creates an independent walker', e.active && w.physics.world.bodies.includes(e.body))
    const parked = car.position.clone()
    e.firstPerson = true
    e.yaw = 0
    w.controls.actions.up = true
    e.update()
    check('Walk speed', Math.abs(e.body.velocity.x - 3.2) < 0.01)
    w.controls.actions.boost = true
    e.update()
    check('Run speed', Math.abs(e.body.velocity.x - 7) < 0.01)
    w.controls.actions.right = true
    e.update()
    check('Diagonal speed is normalized', Math.abs(Math.hypot(e.body.velocity.x, e.body.velocity.y) - 7) < 0.01)
    if(w.controls.touch)
    {
        const joystick = w.controls.touch.joystick
        joystick.active = true
        joystick.angle.originalValue = Math.PI / 2
        e.update()
        check('Touch joystick forward follows the first-person view', e.body.velocity.x > 6.9 && Math.abs(e.body.velocity.y) < 0.01)
        joystick.active = false
    }
    check('Car remains parked', car.position.distanceTo(parked) < 0.01)
    w.guidedTour.clearControls()
    e.body.position.set(-40, -45, 0.4)
    w.arcade.update()
    check('Arcade follows pedestrian', !w.arcade.$panel.hidden)
    e.body.position.set(0, -15, 0.4)
    w.arcade.update()
    check('Arcade hides away from pedestrian', w.arcade.$panel.hidden)
    e.body.position.set(20, -30, 0.4)
    e.enterCar()
    check('Cannot enter car from far away', e.active)
    e.body.position.set(parked.x, parked.y + 2, 0.4)
    e.enterCar()
    check('Nearby re-entry removes walker body', !e.active && !w.physics.world.bodies.includes(e.body))
    e.firstPerson = false
    e.toggleView()
    e.updateCamera()
    check('First-person camera uses eye height and close near plane', w.camera.instance.near === 0.08 && Math.abs(w.camera.instance.position.z - car.position.z - 0.85) < 0.01)
    e.toggleView()
    check('Camera restores overhead projection', w.camera.instance.near === 1 && w.camera.instance.fov === 40)
    e.exitCar()
    // Walk against one of the actual static tree bodies.
    e.firstPerson = true
    e.yaw = 0
    e.body.position.set(-8, -11, 0.4)
    w.controls.actions.up = true
    for(let i = 0; i < 120; i++) { e.update(); w.physics.world.step(1 / 60) }
    check('Trees block walking', e.body.position.x < -6.7)
    // NPC geometry overlaps the path but contributes no contact constraints.
    const npc = w.pedestrians.people[0]
    npc.position.set(1, -15, 0.09)
    e.body.position.set(0, -15, 0.4)
    for(let i = 0; i < 90; i++) { e.update(); w.physics.world.step(1 / 60) }
    check('Walker passes through NPC', e.body.position.x > 2)
    check('Crowd has no collision bodies', w.pedestrians.people.length === 12 && !w.physics.world.bodies.some(body => body.collisionRole === 'npc'))
    w.guidedTour.clearControls()
    w.arcade.start('bowling')
    check('Arcade start safely returns to driving', !e.active && !e.firstPerson && w.arcade.state === 'countdown')
    w.arcade.exit()
    check('Arcade exit leaves controls usable', !e.blocked)
    return results
})()
