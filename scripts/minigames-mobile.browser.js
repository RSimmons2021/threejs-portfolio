(async () => {
    const w = application.world, m = w.miniGames, r = w.careerRPG, results = []
    const check = (label, ok) => { if(!ok) throw Error(label); results.push(label) }
    check('Mobile site input is enabled', application.config.touch && w.controls.touch)
    for(const id of ['packetRun', 'beatTunnel', 'signalNoise', 'handoff', 'containment', 'shipIt']) {
        r.close(); m.destroy(); m.start(id, () => {})
        const deadline = performance.now() + 15000
        while(m.state !== 'ready') { if(performance.now() > deadline) throw Error('Readiness timeout'); await new Promise(requestAnimationFrame) }
        m.begin(); m.countdown = 0; m.update(); m.pause()
        // Put the actual play buttons back without advancing game time.
        m.setButtons(m.game.controls)
        await new Promise(requestAnimationFrame)
        const buttons = [...m.$actions.querySelectorAll('button')]
        check(`${id} touch actions fit the viewport`, buttons.every(b => { const p = b.getBoundingClientRect(); return p.left >= 0 && p.right <= innerWidth && p.top >= 0 && p.bottom <= innerHeight && p.height >= 48 }))
        check(`${id} hides the old driving touch controls`, [...document.querySelectorAll('.world-touch-control')].every(el => getComputedStyle(el).display === 'none'))
        const p = m.$panel.getBoundingClientRect()
        check(`${id} header fits the viewport`, p.left >= 0 && p.right <= innerWidth)
        if(id === 'signalNoise' && innerWidth < innerHeight) {
            m.updateCamera()
            const v = m.cameraLook.clone()
            check('Portrait camera shows both outer sorting bins', [-6.2, 6.2].every(x => { v.set(420 + x, 321.5, 1).project(w.camera.instance); return Math.abs(v.x) <= 1 }))
        }
        m.destroy()
    }
    check('Mobile controls return after every game', [...document.querySelectorAll('.world-touch-control')].every(el => getComputedStyle(el).display !== 'none'))
    return results
})()
