// Capture the real city with the portfolio's typography (no external artwork).
// After entering the site at a 1200 x 630 viewport:
// npx agent-browser eval --stdin < scripts/social-preview.browser.js
// npx agent-browser screenshot static/social/city-explorer-2026.png
(async () => {
    await document.fonts.ready
    const app = window.application, w = app.world
    w.arcade.exit(false)
    w.explorer.enterCar(true)
    if(w.explorer.firstPerson) w.explorer.toggleView()
    w.ghostCar.container.visible = false
    w.visitGhost.container.visible = false
    w.weather.settings.autoCycle = false
    w.weather.setWeather('clear')
    w.dayNightCycle.settings.realTime = false
    w.dayNightCycle.settings.currentTime = 0.77
    w.dayNightCycle.update()
    const car = w.physics.car.chassis.body
    car.position.set(0, -7, 0.4)
    car.quaternion.setFromEuler(0, 0, -0.4)
    car.velocity.set(0, 0, 0)
    w.startingScreen.area.container.visible = false
    w.sections.intro.container.visible = false
    for(let i = 0; i < 3; i++) app.time.trigger('tick')
    app.time.stop()
    for(const material of Object.values(w.materials.shades.items)) material.uniforms.uRevealProgress.value = 1
    w.advancedLighting.container.visible = false
    app.camera.instance.position.set(2, -23, 15)
    app.camera.instance.lookAt(0, -3, 1.4)
    app.camera.instance.fov = 43
    app.camera.instance.setViewOffset(1200, 630, -240, 0, 1200, 630)
    app.camera.instance.updateProjectionMatrix()
    app.camera.instance.updateMatrixWorld()
    app.passes.horizontalBlurPass.enabled = false
    app.passes.verticalBlurPass.enabled = false
    app.renderer.setPixelRatio(1)
    app.renderer.setSize(1200, 630)
    app.passes.composer.setPixelRatio(1)
    app.passes.composer.setSize(1200, 630)
    app.passes.composer.render()
    document.querySelector('#social-preview')?.remove()
    const style = document.createElement('style')
    style.textContent = `body > :not(canvas):not(#social-preview):not(style):not(script) { display: none !important; }
        #social-preview { position:fixed; inset:0; z-index:9999; padding:48px; color:#ffe5af;
            background:linear-gradient(90deg,#16130e 0%,#16130efa 29%,#16130eaa 43%,transparent 64%); }
        #social-preview .eyebrow { font:12px 'JetBrains Mono'; letter-spacing:3px; color:#ffb627; }
        #social-preview h1 { margin:66px 0 24px; font:76px/.96 'Archivo Black'; letter-spacing:-4px; text-transform:uppercase; }
        #social-preview p { font:15px/1.8 'JetBrains Mono'; color:#e3cba0; }
        #social-preview .tag { position:absolute; left:48px; bottom:46px; padding:14px 18px;
            border:1px solid #b58a3e; font:12px 'JetBrains Mono'; letter-spacing:1px; background:#241b0f; }
        #social-preview .number { position:absolute; right:42px; bottom:42px; color:#fff0cd;
            font:12px 'JetBrains Mono'; letter-spacing:2px; text-shadow:0 2px 6px #000; }`
    document.head.appendChild(style)
    const overlay = document.createElement('div')
    overlay.id = 'social-preview'
    overlay.innerHTML = `<div class="eyebrow">AN INTERACTIVE CITY PORTFOLIO</div>
        <h1>Richard<br>Simmons<span style="color:#ffb627">.</span></h1>
        <p>Product designer.<br>Full-stack engineer.<br>A city full of things I've built.</p>
        <div class="tag">DRIVE. WALK. EXPLORE. ↗</div><div class="number">06 PROJECTS / ONE CITY</div>`
    document.body.appendChild(overlay)
    return 'Social preview ready at 1200 × 630'
})()
