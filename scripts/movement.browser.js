// Run after ENTER SITE and the reveal. Uses the actual camera, walker and car
// systems; restores the car/camera afterwards. Touch assertions run when the
// site's existing touch controls have been activated.
(async () => {
    const a = application, w = a.world, e = w.explorer, rig = w.cameraRig
    const body = w.physics.car.chassis.body, h = w.hoverFlight, controls = w.controls
    const camera = w.camera.instance, time = w.time, results = []
    const check = (label, value) => { if(!value) throw new Error(label); results.push(label) }
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
    const saved = { position: body.position.clone(), quaternion: body.quaternion.clone(),
        cameraPosition: camera.position.clone(), cameraQuaternion: camera.quaternion.clone(),
        mode: rig.mode, orbit: { ...rig.orbit }, yaw: rig.yaw, delta: time.delta }
    const clear = () => { w.guidedTour.clearControls(); if(controls.touch) controls.touch.joystick.active = false }
    const setView = yaw => {
        camera.up.set(0, 0, 1)
        camera.position.set(0, -20, 4)
        camera.lookAt(Math.cos(yaw) * 10, -20 + Math.sin(yaw) * 10, 2)
        camera.updateMatrixWorld()
    }
    const settle = () => { for(let i = 0; i < 60; i++) e.update() }
    try
    {
        w.arcade.exit(false); e.enterCar(true); h.forceLand(); clear()
        if(e.firstPerson) e.toggleView()
        body.position.set(10, -29, 0.6); body.velocity.set(0, 0, 0)
        e.exitCar()
        check('Walker exits safely before camera-relative tests', e.active && !e.blocked)
        time.stop(); time.delta = 1000 / 60
        for(const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
        {
            clear(); setView(yaw); e.body.velocity.set(0, 0, 0)
            controls.actions.up = true; settle()
            const v = e.body.velocity
            check(`Walking W follows the rendered view (${yaw.toFixed(2)})`,
                v.x * Math.cos(yaw) + v.y * Math.sin(yaw) > 3.1)
            clear(); controls.actions.right = true; settle()
            check(`Walking D moves screen-right (${yaw.toFixed(2)})`,
                v.x * Math.sin(yaw) - v.y * Math.cos(yaw) > 3.1)
        }
        clear(); rig.mode = 'chase'; rig.yaw = 0; rig.orbit.yaw = 0
        rig.orbit.pitch = 0; rig.orbit.drag = null; rig.wasOnFoot = true; rig.initialised = false
        setView(0)
        controls.actions.right = true
        // Capture the explicitly authored view before the first chase update.
        e.update()
        for(let i = 0; i < 240; i++) { rig.update(1000 / 60); e.update() }
        check(`Held strafe remains stable while the walking camera follows behind (yaw=${rig.yaw.toFixed(3)}, velocity=${e.body.velocity.toString()})`, Math.cos(rig.yaw + Math.PI / 2) > .999 && e.body.velocity.y < -3.1)
        rig.orbit.yaw = 0.8; rig.orbit.idle = 0
        for(let i = 0; i < 300; i++) { rig.update(1000 / 60); e.update() }
        check('Walking recenters an idle orbit behind the character', Math.abs(rig.orbit.yaw) < .001)
        rig.orbit.yaw = .8; rig.orbit.drag = { id: 99, x: 0, y: 0 }
        rig.update(1000 / 60)
        check('Deliberate camera drag retains the chosen orbit', rig.orbit.yaw === .8)
        rig.orbit.drag = null

        if(controls.touch)
        {
            const j = controls.touch.joystick
            clear(); setView(Math.PI / 2)
            j.active = true; j.angle.originalValue = Math.PI / 2; settle()
            check('Touch walking up follows the actual view', e.body.velocity.y > 3.1)
            j.angle.originalValue = 0; settle()
            check('Touch walking right strafes screen-right', e.body.velocity.x > 3.1)
            // Run the real joystick tick, which maps screen coordinates to yaw.
            rig.yaw = Math.PI / 2; rig.orbit.yaw = 0; rig.initialised = false
            j.angle.current.x = j.angle.center.x
            j.angle.current.y = j.angle.center.y - 60
            time.trigger('tick')
            check('Touch driving up targets rendered camera heading', Math.abs(j.angle.value - controls.getViewYaw()) < 0.01)
        }

        clear(); e.enterCar(true)
        // Actual flight controller, both yaw directions and forward thrust.
        h.takeOff(); h.mode = 'flying'; h.yaw = 0
        body.position.set(45, -29, 18); body.velocity.set(0, 0, 0)
        controls.actions.up = true; controls.actions.right = true
        for(let i = 0; i < 30; i++) w.physics.world.step(1 / 60)
        check('Flight D yaws right', h.yaw < -0.5)
        check('Flight W thrust follows the car heading', body.velocity.x > 0)
        clear(); h.yaw = 0; controls.actions.left = true
        for(let i = 0; i < 30; i++) w.physics.world.step(1 / 60)
        check('Flight A yaws left', h.yaw > 0.5)
        if(controls.touch)
        {
            clear(); controls.touch.joystick.active = true
            controls.touch.joystick.angle.value = Math.PI / 2; h.yaw = 0
            for(let i = 0; i < 30; i++) w.physics.world.step(1 / 60)
            check('Flight follows the touch world heading', h.yaw > 0.5 && h.throttle > 0)
        }

        clear(); h.forceLand(); rig.mode = 'chase'; time.resume()
        // Real raycast-wheel driving, not just wheel-steering signs.
        for(const [key, expected] of [['right', -1], ['left', 1]])
        {
            clear(); body.position.set(0, -15, 0.6); body.quaternion.set(0, 0, 0, 1)
            body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0)
            body.wakeUp(); w.physics.car.oldPosition.copy(body.position)
            w.physics.car.steering = 0
            await wait(450)
            controls.actions.up = true
            await wait(900)
            controls.actions[key] = true
            await wait(600)
            const yaw = w.physics.car.angle
            check(`Driving ${key === 'right' ? 'D' : 'A'} turns ${key} (yaw=${yaw.toFixed(3)}, speed=${w.physics.car.speed.toFixed(4)}, steering=${w.physics.car.steering.toFixed(3)}, position=${body.position.toString()})`, yaw * expected > 0.005)
        }
        return results
    }
    finally
    {
        clear(); e.enterCar(true); h.forceLand()
        body.position.copy(saved.position); body.quaternion.copy(saved.quaternion)
        body.velocity.set(0, 0, 0); body.angularVelocity.set(0, 0, 0)
        camera.position.copy(saved.cameraPosition); camera.quaternion.copy(saved.cameraQuaternion)
        camera.updateMatrixWorld(); rig.mode = saved.mode; rig.orbit = saved.orbit; rig.yaw = saved.yaw
        rig.wasOnFoot = false; rig.initialised = false; time.delta = saved.delta; time.resume()
    }
})()
