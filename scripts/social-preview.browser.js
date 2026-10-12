// Capture the real Neon District with the current portfolio typography.
// Enter ?guide=0 at 1200 x 630, then run:
// agent-browser eval --stdin < scripts/social-preview.browser.js
// agent-browser screenshot static/social/neon-district-2026-10.png
// Reload the disposable browser session afterwards to restore normal gameplay.
(async () =>
{
    await document.fonts.ready
    const app = window.application, w = app.world
    if(!w.neonCity) throw new Error('The Neon District must be loaded before capture')
    w.visitorGuide.close(); w.visitorGuide.clear()
    w.arcade.exit(false); w.miniGames.destroy(); w.interiors.leave()
    w.explorer.enterCar(true)
    if(w.explorer.firstPerson) w.explorer.toggleView()
    w.guidedTour.clearControls()
    w.weather.settings.autoCycle = false
    w.weather.setWeather('clear')
    Object.assign(w.weather.values, w.weather.states.clear)
    w.weather.rain.material.opacity = 0
    w.dayNightCycle.settings.realTime = false
    w.dayNightCycle.settings.autoPlay = false
    w.dayNightCycle.settings.currentTime = 22 / 24
    w.dayNightCycle.update()
    w.reveal.matcapsProgress = 1
    for(const material of Object.values(w.materials.shades.items)) material.uniforms.uRevealProgress.value = 1
    w.hoverFlight.forceLand()
    const car = w.physics.car.chassis.body
    car.position.set(0, -30, .6)
    car.quaternion.setFromEuler(0, 0, -.9)
    car.velocity.set(0, 0, 0); car.angularVelocity.set(0, 0, 0)
    // Let the real body/mesh interpolation settle; don't place a substitute car.
    for(let i = 0; i < 30; i++) await new Promise(requestAnimationFrame)
    app.time.stop()
    w.cameraRig.mode = 'classic'
    app.camera.orbitControls.enabled = false
    app.camera.instance.clearViewOffset()
    app.camera.instance.position.set(6, -44, 9)
    app.camera.instance.up.set(0, 0, 1)
    app.camera.instance.lookAt(0, -19, 5)
    app.camera.instance.fov = 64
    app.camera.instance.setViewOffset(1200, 630, -210, 0, 1200, 630)
    app.camera.instance.updateProjectionMatrix()
    app.camera.instance.updateMatrixWorld()
    app.renderer.setPixelRatio(1)
    app.renderer.setSize(1200, 630)
    app.passes.composer.setPixelRatio(1)
    app.passes.composer.setSize(1200, 630)
    app.time.trigger('render')
    document.querySelector('#social-preview')?.remove()
    document.querySelector('#social-preview-style')?.remove()
    const style = document.createElement('style')
    style.id = 'social-preview-style'
    style.textContent = `body > :not(canvas):not(#social-preview):not(style):not(script) { display:none !important; }
        #social-preview { position:fixed; inset:0; z-index:9999; padding:48px; color:#e6f0f4;
            background:linear-gradient(90deg,#07131e 0%,#07131ef5 25%,#07131eb0 39%,#07131e10 68%,transparent 82%); }
        #social-preview .eyebrow { font:11px 'JetBrains Mono'; letter-spacing:2.4px; color:#68e9f5; }
        #social-preview h1 { margin:76px 0 26px; font:72px/.98 'Archivo Black'; letter-spacing:-3.4px; text-transform:uppercase; }
        #social-preview p { font:14px/1.9 'JetBrains Mono'; color:#abc5ce; }
        #social-preview .tag { position:absolute; left:48px; bottom:48px; padding:16px 18px;
            border:1px solid #68e9f55c; font:11px 'JetBrains Mono'; letter-spacing:1.1px; color:#68e9f5; background:#0a2231dd; }
        #social-preview .number { position:absolute; right:42px; bottom:48px; color:#cfe9f0;
            font:11px 'JetBrains Mono'; letter-spacing:1.5px; text-shadow:0 2px 6px #000; }`
    document.head.appendChild(style)
    const overlay = document.createElement('div')
    overlay.id = 'social-preview'
    overlay.innerHTML = `<div class="eyebrow">PORTFOLIO / NEON DISTRICT</div>
        <h1>Richard<br>Simmons<span style="color:#68e9f5">.</span></h1>
        <p>Product designer.<br>Full-stack engineer.<br>Six projects. One neon district.</p>
        <div class="tag">DRIVE / FLY / WALK / SKATE ↗</div><div class="number">06 PROJECTS / EXPLORE THE WORK</div>`
    document.body.appendChild(overlay)
    return 'Neon District social preview ready at 1200 × 630'
})()
