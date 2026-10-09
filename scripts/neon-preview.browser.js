// Run after entering the default site URL (desktop viewport 1280 x 720 recommended):
// agent-browser eval --stdin < scripts/neon-preview.browser.js
// agent-browser eval 'neonPreview(3, "rain")'
// agent-browser screenshot docs/screenshots/neon-district/runtime-0300-rain.png
(() => {
    const a = application, w = a.world, camera = a.camera
    if(!w.neonCity) throw new Error('Enter the Neon preview first (omit ?neon=0)')
    w.arcade.exit(false)
    w.explorer.enterCar(true)
    if(w.explorer.firstPerson) w.explorer.toggleView()
    w.experienceDirector.setInteractionLock('look-preview', true)
    w.physics.car.chassis.body.position.set(0, -30, 0.4)
    Object.assign(w.experienceDirector.lockedCarPose, { px: 0, py: -30, pz: 0.4 })
    w.reveal.matcapsProgress = 1
    for(const material of Object.values(w.materials.shades.items)) material.uniforms.uRevealProgress.value = 1
    camera.orbitControls.enabled = true
    camera.instance.position.set(0, -42, 4.2)
    camera.instance.fov = 64
    camera.instance.lookAt(0, -12, 13)
    camera.instance.updateProjectionMatrix()
    camera.instance.updateMatrixWorld()
    const style = document.createElement('style')
    style.textContent = 'body > :not(canvas):not(script):not(style) { display: none !important; }'
    document.head.appendChild(style)
    window.neonPreview = async (hour, weather = 'clear') => {
        w.dayNightCycle.settings.realTime = false
        w.dayNightCycle.settings.autoPlay = false
        w.dayNightCycle.settings.currentTime = hour / 24
        w.dayNightCycle.update()
        w.weather.settings.autoCycle = false
        w.weather.setWeather(weather)
        Object.assign(w.weather.values, w.weather.states[weather])
        // Production weather transitions are eased. Review captures must not
        // retain fading rain streaks in a frame labelled CLEAR.
        w.weather.rain.material.opacity = weather === 'rain' ? w.weather.values.rain * 0.55 : 0
        w.weather.update()
        w.dayNightCycle.update()
        w.sky.update()
        w.materials.cyber.update(w)
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
        return { hour, weather: w.weather.state, stats: a.performanceMonitor.stats }
    }
    return 'Look preview ready. neonPreview(hour, weather) keeps the same camera.'
})()
