// Run after ENTER SITE. Exercises the real travel actions and their UI states.
(async () =>
{
    const w = application.world, e = w.explorer, h = w.hoverFlight, results = []
    const check = (label, ok) => { if(!ok) throw new Error(label); results.push(label) }
    w.visitorGuide.close(); w.visitorGuide.clear()
    w.arcade.exit(false); e.enterCar(true); h.forceLand()
    w.guidedTour.goTo({ id: 'intro', x: 0, y: -15, z: .6, heading: 0, cameraAngle: 'default', zoom: .6 })
    w.visitorGuide.clear()
    w.guidedTour.clearControls()
    h.updateInterface(); e.updateInterface()

    check('System X-ray button is removed', !document.querySelector('[data-experience-action="xray"]'))
    check('Top project shortcut menu is removed', !w.guidedTour.$element.querySelector('select'))
    check('All travel actions share one dock', e.panel.contains(h.button) && e.panel.contains(h.pad))
    check('Driving has an available exit action', !e.modeButton.disabled && e.travelState.textContent === 'Driving')

    h.button.click()
    check('Takeoff gives immediate feedback and prevents duplicate actions', h.mode === 'takeoff' && h.button.disabled && e.modeButton.disabled && e.travelState.textContent === 'Taking off')
    h.timer = 1; h.step(1 / 60); h.updateInterface()
    check('Flight offers Land and explains why exit is unavailable', h.mode === 'flying' && h.button.textContent.includes('Land') && !h.button.disabled && e.modeButton.disabled && e.modeButton.title.includes('Land'))
    check('Altitude holds live inside the dock', !h.pad.hidden && e.panel.contains(h.pad))
    const climb = h.pad.querySelector('[data-dir="climb"]')
    climb.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    check('Altitude supports a held keyboard action', h.touchClimb)
    climb.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }))
    check('Altitude stops on release', !h.touchClimb)
    climb.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }))
    window.dispatchEvent(new Event('blur'))
    check('Altitude cannot stick after losing focus', !h.touchClimb && !h.touchDescend)

    e.viewButton.click()
    check('First person exposes the return view action', e.firstPerson && e.viewButton.getAttribute('aria-pressed') === 'true' && e.viewButton.textContent.includes('City view'))
    e.viewButton.click()
    h.button.click()
    check('Landing is a disabled transition', h.mode === 'landing' && h.button.disabled && e.travelState.textContent === 'Landing')
    h.forceLand()
    check('Touchdown restores driving and exit', h.mode === 'grounded' && !h.button.disabled && !e.modeButton.disabled && h.pad.hidden)

    e.modeButton.click()
    h.updateInterface()
    check('Exit car switches the dock to on-foot actions', e.active && h.button.hidden && !e.runButton.hidden && e.modeButton.textContent.includes('Enter car') && e.travelState.textContent === 'On foot')
    e.runButton.click()
    check('Skateboard changes the mode and offers Walk', e.skating && e.travelState.textContent === 'Skating' && e.runButton.textContent.includes('Walk') && e.runButton.getAttribute('aria-pressed') === 'true')
    e.runButton.click()
    e.modeButton.click()
    h.updateInterface()
    check('Re-entering the car restores the three driving actions', !e.active && !h.button.hidden && e.runButton.hidden && !e.modeButton.disabled)

    w.experienceDirector.setInteractionLock('travel-test', true)
    h.button.click()
    check('Travel cannot begin behind an open overlay', h.mode === 'grounded')
    e.update()
    check('Locked interactions hide the whole dock', e.panel.hidden)
    w.experienceDirector.setInteractionLock('travel-test', false)
    e.update()
    check('Closing the overlay restores the dock', !e.panel.hidden)
    return { passed: results.length, results }
})()
