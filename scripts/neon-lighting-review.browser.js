// Run after ENTER SITE, then neonLightingReview(14, 'clear' | 'rain', 'avenue' | 'street').
// Test-only fixed framing; production navigation and local-time lighting are unchanged.
(() => {
    const a = application, w = a.world, camera = a.camera
    if(!w.neonCity) throw new Error('Enter the Neon site first')
    if(w.reveal.matcapsProgress < 0.99) throw new Error('Wait for the entry reveal before capturing')
    w.arcade.exit(false)
    w.explorer.enterCar(true)
    if(w.explorer.firstPerson) w.explorer.toggleView()
    w.hoverFlight.forceLand()
    w.cameraRig.mode = 'classic'
    camera.orbitControls.enabled = true
    w.experienceDirector.setInteractionLock('lighting-review', true)
    const style = document.createElement('style')
    style.textContent = 'body > :not(canvas):not(script):not(style) { display: none !important; }'
    document.head.appendChild(style)
    window.neonLightingReview = async (hour = 14, weather = 'clear', view = 'avenue') => {
        const street = view === 'street'
        const pose = street ? [50, -29, 0.5] : [50, -29, 18]
        w.physics.car.chassis.body.position.set(...pose)
        w.physics.car.chassis.body.quaternion.set(0, 0, 0, 1)
        Object.assign(w.experienceDirector.lockedCarPose, { px: pose[0], py: pose[1], pz: pose[2], qx: 0, qy: 0, qz: 0, qw: 1 })
        camera.instance.position.set(38, -29, street ? 3.5 : 21.5)
        camera.instance.fov = 66
        camera.instance.lookAt(95, -29, street ? 6 : 18)
        camera.instance.updateProjectionMatrix()
        camera.instance.updateMatrixWorld()
        w.dayNightCycle.settings.realTime = false
        w.dayNightCycle.settings.autoPlay = false
        w.dayNightCycle.settings.currentTime = hour / 24
        w.weather.settings.autoCycle = false
        w.weather.setWeather(weather)
        Object.assign(w.weather.values, w.weather.states[weather])
        w.weather.rain.material.opacity = weather === 'rain' ? w.weather.values.rain * 0.55 : 0
        w.weather.update(); w.dayNightCycle.update()
        for(let i = 0; i < 240; i++) w.materials.cyber.update(w)
        w.neonCity.lastUpdate = -Infinity
        w.neonCity.update()
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        return { hour, weather, view, stats: a.performanceMonitor.stats }
    }
    return 'Lighting review ready'
})()
