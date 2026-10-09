// Run after entering the default site URL and waiting for the reveal:
// agent-browser eval --stdin < scripts/neon.browser.js
(() => {
    const a = application, w = a.world, city = w.neonCity, results = []
    const check = (label, value) => { if(!value) throw new Error(label); results.push(label) }
    const layout = a.resources.items.cyberLayout
    check('Neon resources are ready', a.config.neon && city && a.resources.items.cyberKit && a.resources.items.cyberTraffic)
    check('glTF kit and mask use the glTF UV convention', !w.materials.cyber.atlas.flipY && !w.materials.cyber.mask.flipY)
    check('Whole district is instanced per module', city.modules.length >= 25 && city.modules.every(m => m.n > 0))
    check('Every tower, skybridge and pad collides', city.bodies.filter(b => b.collisionRole !== 'neon-prop').length === layout.towers.length + layout.skybridges.length + layout.pads.length)
    check('Camera colliders mirror the bodies', city.colliders.length === city.bodies.length)
    check('Old Manhattan towers are gone', !w.city.container.children.some(m => /block/.test(m.name)))
    for(const signs of city.signs.children)
    {
        check(`Sign transforms are finite (${signs.count})`, [...signs.instanceMatrix.array].every(Number.isFinite))
        check('Each sign uses its own atlas rectangle', signs.geometry.attributes.aRect.count === signs.count)
    }
    check('Flying traffic is instanced on the GPU', w.neonTraffic.meshes.length === 6 && w.neonTraffic.meshes.every(m => m.geometry.instanceCount > 0))
    check('Sky dome replaces the cartoon sky', w.neonSky && !w.sky.container.visible && !w.floor.container.visible)
    check('Crisp render avoids old blur passes', !a.passes.horizontalBlurPass.enabled && !a.passes.verticalBlurPass.enabled)

    // Day/night: sun only by day, neon dims by day, clock stays the visitor's.
    const cycle = w.dayNightCycle, original = { ...cycle.settings }, weather = w.weather.state
    cycle.settings.realTime = false
    cycle.settings.autoPlay = false
    cycle.settings.currentTime = 3 / 24
    w.careerRPG.applyClock()
    check('Career budget does not overwrite the visual clock', cycle.settings.currentTime === 3 / 24)
    cycle.update(); w.materials.cyber.update(w)
    const night = w.materials.cyber.shared.uNeonIntensity.value
    check('No sun at night', w.materials.cyber.shared.uSunColor.value.r === 0)
    const headlights = w.advancedLighting.settings
    const headlightSettings = [headlights.headlightConesEnabled, headlights.headlightConesAutoNight]
    headlights.headlightConesEnabled = true; headlights.headlightConesAutoNight = true
    w.advancedLighting.update()
    check('No direct headlight cones even when forced on at night', !w.advancedLighting.headlightCones.group.visible)
    headlights.headlightConesEnabled = headlightSettings[0]
    headlights.headlightConesAutoNight = headlightSettings[1]
    const shared = w.materials.cyber.shared
    check('Local neon spill obeys the tier budget', shared.uSpillCount.value <= Math.min(8, a.quality.settings.lights))
    check('Spill light positions are finite', shared.uSpillPosition.value.every(p => p.toArray().every(Number.isFinite)))
    cycle.settings.currentTime = 14 / 24
    cycle.update(); w.materials.cyber.update(w)
    check('Daytime neon dims but stays visible', w.materials.cyber.shared.uNeonIntensity.value > 0 && w.materials.cyber.shared.uNeonIntensity.value < night)
    check('Warm key sun by day', w.materials.cyber.shared.uSunColor.value.r > 3)
    const clearSun = shared.uSunColor.value.r
    const auto = w.weather.settings.autoCycle
    w.weather.settings.autoCycle = false
    w.weather.setWeather('rain'); w.weather.update()
    w.materials.cyber.update(w)
    check('Daytime rain preview persists', w.weather.state === 'rain')
    check('Rain clouds dim the key sunlight', shared.uSunColor.value.r < clearSun * 0.5)
    Object.assign(cycle.settings, original)
    w.weather.setWeather(weather); w.weather.settings.autoCycle = auto
    cycle.update(); w.materials.cyber.update(w)

    // Drive <-> fly.
    const e = w.explorer, h = w.hoverFlight, body = w.physics.car.chassis.body
    e.enterCar(true); w.arcade.exit(false)
    body.position.set(10, -30, 0.6); body.velocity.set(0, 0, 0); body.quaternion.set(0, 0, 0, 1)
    for(let i = 0; i < 30; i++) w.physics.world.step(1 / 60)
    h.toggle()
    check('Take-off keeps the chassis body in the world', h.airborne && w.physics.world.bodies.includes(body))
    h.keys.climb = true
    for(let i = 0; i < 180; i++) w.physics.world.step(1 / 60)
    h.keys.climb = false
    check('Climbs while flying', h.mode === 'flying' && body.position.z > 8)
    check('Sky columns read the flying chassis while ground zones reject it', e.proximity.airborne && e.proximity.position === body.position
        && w.areas.items.filter(a => a.hasKey && !a.skyAccess).every(a => !a.contains(body.position, true)))
    e.exitCar()
    check('Cannot get out mid-air', !e.active)
    for(let i = 0; i < 120; i++) w.physics.world.step(1 / 60)
    check('Altitude holds with no input', Math.abs(body.velocity.z) < 1)
    h.forceLand()
    check('Landing reattaches the wheels', h.mode === 'grounded' && w.physics.world.bodies.includes(body))
    h.toggle()
    w.arcade.start('bowling'); h.tick()
    check('Arcade start forces a landing', h.mode === 'grounded')
    w.arcade.exit()
    check('Cockpit dash is a live canvas', w.cockpitDash.material.map === w.cockpitDash.texture)
    return results
})()
