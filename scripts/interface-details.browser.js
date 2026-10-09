// Execute on the welcome screen, with guide enabled. Repeat at desktop/mobile.
(async () =>
{
    const app = window.application, results = []
    if(innerWidth <= 768)
    {
        const touch = new Touch({ identifier: 99, target: document.body, clientX: 1, clientY: 1 })
        window.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch], touches: [touch] }))
        window.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], touches: [] }))
    }
    const check = (name, value) => { if(!value) throw new Error(name); results.push(name) }
    const frames = async count => { for(let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    window.validationErrors = []
    window.addEventListener('error', event => window.validationErrors.push(event.message))
    window.addEventListener('unhandledrejection', event => window.validationErrors.push(String(event.reason)))
    const intro = document.querySelector('.js-brief-open')
    intro.focus(); intro.click()
    const brief = document.querySelector('.brief')
    check('Overview is available before WebGL entry', brief.open)
    check('Overview contains all six projects in requested order', [...brief.querySelectorAll('.brief__project h3')].map(h => h.firstChild.textContent).join('|') === 'Zoan Collective|Agent Lab|DeepSeek Harness Desktop|Agent Relay|Lucid|ASO Audit Agent')
    check('Brief has four keyboard-readable section links', brief.querySelectorAll('.brief__nav a').length === 4)
    check('Resume URL is the bundled PDF', brief.querySelector('.js-resume').href.endsWith('.pdf'))
    brief.querySelector('[data-brief="close"]').click(); await frames(2)
    check('Brief close restores invoking control', document.activeElement === intro)
    if(!app.world.started) document.querySelector('.js-city-start').click()
    await frames(240)
    const w = app.world, guide = w.visitorGuide, mini = w.miniGames, e = w.explorer
    check('Landing opens the information chooser', guide.$dialog.open)
    check('Chooser separates information from optional games', guide.$dialog.querySelector('[aria-labelledby="visitor-guide-information"]') && guide.$dialog.querySelector('[aria-labelledby="visitor-guide-play"]'))
    check('Landing chooser pauses movement', w.experienceDirector.locks.has('guide'))
    check('Chooser resume link works without entering the city game', guide.$dialog.querySelector('.js-resume').href.endsWith('.pdf'))
    check('Landing chooser offers all six specific projects', guide.$dialog.querySelector('select').options.length === 6)
    guide.$dialog.querySelector('[data-destination="projects"]').click(); await frames(20)
    check('Information selection releases movement lock', !guide.$dialog.open && !w.experienceDirector.locks.has('guide'))
    check('Project choice points to Zoan first', guide.destination.project.name === 'Zoan Collective')
    check('Hybrid street guide uses two bounded batches', guide.container.children.length === 2 && guide.markers.isInstancedMesh && guide.markers.count > 0 && guide.markers.count <= 16 && guide.ribbon.geometry.attributes.position.count === 128)
    check('Directions include distance and a direct-read option', /m to destination/.test(guide.$direction.textContent) && guide.$read.textContent === 'Read case study')
    const rect = guide.$route.getBoundingClientRect()
    check('Directions fit the viewport', rect.left >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight)
    for(let index = 0; index < 6; index++)
    {
        guide.choose('projects', index); guide.read(); await frames(3)
        const portal = w.experienceDirector.$portal
        check(`Case study ${index + 1} can open without game progress`, portal.open)
        check(`Case study ${index + 1} labels selected slide`, portal.querySelector('[aria-pressed="true"][data-portal-slide]'))
        check(`Case study ${index + 1} gives destination and new-tab behavior`, portal.querySelector('.js-portal-live').getAttribute('aria-label').includes('new tab'))
        check(`Case study ${index + 1} counts slides`, /view 1 of 3/.test(portal.querySelector('.js-portal-caption').textContent))
        w.experienceDirector.closePortal(); await frames(20)
    }
    guide.choose('experience'); guide.read(); await frames(3)
    check('Experience destination is information, not a career game door', guide.destination.area === guide.experienceArea && guide.destination.y === -54)
    check('Experience is readable without unlocking a career role', brief.open && brief.scrollTop > 200)
    brief.querySelector('[data-brief="close"]').click(); await frames(2)
    guide.choose('play'); await frames(20)
    check('Arcade direction is labeled optional games', guide.$category.textContent === 'OPTIONAL / GAMES' && guide.$route.dataset.category === 'play')
    check('Game guidance has a distinct color', guide.markerMaterial.color.getHexString() === 'e8a6ff')
    guide.clear(); w.guidedTour.goTo({ id: 'projects', x: 0, y: -30, z: .5, heading: 0, cameraAngle: 'default', zoom: .6 }); guide.clear()
    await frames(35)
    for(const id of ['packetRun','beatTunnel','signalNoise','handoff','containment','shipIt'])
    {
        if(e.firstPerson) e.toggleView()
        e.exitCar(); check(`${id}: visitor arrives on foot`, e.active)
        e.body.position.set(-22,-43,.5)
        mini.start(id, () => {}, { practice: true })
        for(let i = 0; mini.state === 'loading' && i < 600; i++) await frames(1)
        check(`${id}: arcade saves an in-car return state`, mini.state === 'ready' && mini.saved.active === false && mini.saved.parked)
        check(`${id}: Begin is focused for keyboard entry`, document.activeElement === mini.$actions.querySelector('button'))
        mini.destroy(); await frames(20)
        check(`${id}: returns to the car without a walker collider`, !e.active && !w.physics.onFoot && !w.physics.world.bodies.includes(e.body))
        check(`${id}: returns finite camera and car pose`, app.camera.instance.position.toArray().every(Number.isFinite) && Number.isFinite(w.physics.car.chassis.body.position.z))
    }
    for(const game of ['sprint', 'bowling'])
    {
        e.exitCar(); check(`${game}: visitor arrives walking`, e.active)
        e.body.position.set(-22,-43,.5)
        w.arcade.start(game); await frames(20)
        check(`${game}: visitor is spawned in the car`, !e.active && !w.physics.onFoot && w.arcade.state === 'countdown')
        w.arcade.exit(); await frames(25)
    }
    check('Car shell is opaque and rendered from inside', w.car.chassis.interiorMaterial.side === 2 && !w.car.chassis.interiorMaterial.transparent)
    check('Shared city material remains front-sided', w.materials.cyber.forSlot('nd_atlas').side === 0)
    const tools = document.querySelector('.experience-tools').getBoundingClientRect(), controls = e.panel.getBoundingClientRect()
    check('Mobile toolbar does not cover movement controls', innerWidth > 768 || tools.top >= controls.bottom || tools.left >= controls.right || controls.left >= tools.right || tools.bottom <= controls.top)
    check('Native project select has a 44px touch target', document.querySelector('.guided-tour__project').getBoundingClientRect().height >= 44)
    check('No runtime errors', window.validationErrors.length === 0)
    return { passed: results.length, viewport: [innerWidth, innerHeight], results }
})()
