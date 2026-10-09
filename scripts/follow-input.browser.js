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
            rig.yaw = yaw; e.heading = yaw; rig.orbit.yaw = 0; rig.orbit.pitch = 0; rig.initialised = false
            await frames(3)
            const startView = w.controls.getViewYaw()
            a.up = true; await frames(40); a.up = false
            const v = e.body.velocity
            const aligned = (v.x * Math.cos(startView) + v.y * Math.sin(startView)) / Math.max(Math.hypot(v.x, v.y), 0.01)
            check(`${skate ? 'Skateboard' : 'Walk'} W retains the initial view direction ${yaw.toFixed(2)}`, aligned > 0.995)
        }
        w.guidedTour.clearControls(); e.setSkating(false)
        e.body.position.set(0, -15, 0.4); e.body.velocity.set(0, 0, 0)
        e.heading = 0; rig.yaw = 0; rig.orbit.yaw = 0.8; rig.orbit.idle = 0; rig.initialised = false
        await frames(3)
        const view = w.controls.getViewYaw()
        a.right = true; await frames(100); a.right = false
        const v = e.body.velocity, p = e.renderPosition, cam = w.camera.instance.position
        check('Live strafe keeps its initial direction as the orbit recenters',
            (v.x * Math.sin(view) - v.y * Math.cos(view)) / Math.max(Math.hypot(v.x, v.y), 0.01) > 0.995 && Math.abs(rig.orbit.yaw) < .2)
        check('Walking chase ends behind the character after strafing',
            (cam.x-p.x)*Math.cos(e.heading)+(cam.y-p.y)*Math.sin(e.heading) < -2)
        return { passed: results.length, results }
    }
    finally { w.guidedTour.clearControls(); e.setSkating(false); e.enterCar(true); rig.initialised = false }
})()
