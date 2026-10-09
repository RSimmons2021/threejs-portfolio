// Actual running-frame test, not manually sequenced camera/controller calls.
(async () =>
{
    const w = application.world, e = w.explorer, rig = w.cameraRig, a = w.controls.actions
    const results = [], frames = async n => { for(let i = 0; i < n; i++) await new Promise(requestAnimationFrame) }
    const check = (name, ok) => { if(!ok) throw Error(name); results.push(name) }
    w.interiors.leave(); w.arcade.exit(false); w.careerRPG.close(); w.miniGames.destroy()
    e.enterCar(true); w.hoverFlight.forceLand()
    const body = w.physics.car.chassis.body
    body.position.set(10, -29, 0.5); body.velocity.set(0, 0, 0)
    e.exitCar(); if(e.firstPerson) e.toggleView()
    check('Walker is available for live follow input', e.active)
    rig.mode = 'chase'; rig.applyMode(); rig.wasOnFoot = true
    try
    {
        for(const skate of [false, true]) for(const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
        {
            w.guidedTour.clearControls(); e.setSkating(skate)
            e.body.position.set(0, -15, 0.4); e.body.velocity.set(0, 0, 0)
            rig.yaw = yaw; rig.orbit.yaw = 0; rig.orbit.pitch = 0; rig.initialised = false
            await frames(3)
            a.up = true; await frames(40); a.up = false
            const v = e.body.velocity, view = w.controls.getViewYaw()
            const aligned = (v.x * Math.cos(view) + v.y * Math.sin(view)) / Math.max(Math.hypot(v.x, v.y), 0.01)
            check(`${skate ? 'Skateboard' : 'Walk'} W follows the visible chase heading ${yaw.toFixed(2)}`, aligned > 0.995)
        }
        w.guidedTour.clearControls(); e.setSkating(false)
        e.body.position.set(0, -15, 0.4); e.body.velocity.set(0, 0, 0)
        rig.yaw = 0; rig.orbit.yaw = 0.8; rig.initialised = false
        await frames(3); a.right = true; await frames(40); a.right = false
        const view = w.controls.getViewYaw(), v = e.body.velocity
        check('Live strafe follows the orbited view without rotating it',
            (v.x * Math.sin(view) - v.y * Math.cos(view)) / Math.max(Math.hypot(v.x, v.y), 0.01) > 0.995 && rig.orbit.yaw === 0.8)
        return { passed: results.length, results }
    }
    finally { w.guidedTour.clearControls(); e.setSkating(false); e.enterCar(true); rig.initialised = false }
})()
