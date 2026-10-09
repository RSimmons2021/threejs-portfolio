// Run on an entered city: agent-browser --session <name> eval --stdin < this file.
(async () =>
{
    const w = window.application.world
    const frames = async count => { for(let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    const checks = []
    const check = (name, passed, detail) => checks.push({ name, passed: !!passed, detail })
    w.time.resume()
    w.visitorGuide.close()
    w.visitorGuide.clear()
    w.arcade.start('bowling')
    await frames(150)
    const rect = w.arcade.$panel.getBoundingClientRect()
    const position = w.car.chassis.object.position.clone().project(w.camera.instance)
    const car = { x: (position.x + 1) * innerWidth / 2, y: (1 - position.y) * innerHeight / 2 }
    check('Bowling card leaves the car unobscured', !(car.x > rect.left - 35 && car.x < rect.right + 35 && car.y > rect.top - 25 && car.y < rect.bottom + 25), { car, card: rect.toJSON() })
    check('Bowling buttons fit the screen', [...w.arcade.$round.querySelectorAll('button')].filter(b => !b.hidden).every(b => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }))
    // Check the full projected chassis bounds all the way to the pin rack,
    // not only its centre at the starting line. Freeze simulation temporarily.
    w.time.stop()
    const object = w.car.chassis.object, originalPosition = object.position.clone(), originalState = w.arcade.state, originalSuccess = w.arcade.success
    const overlaps = []
    try
    {
        for(const phase of ['countdown', 'running', 'frame-result', 'paused', 'results'])
        {
            w.arcade.state = phase
            // Bowling always completes with a score; only sprint has a failed
            // result. Avoid a timing-dependent synthetic "TRY AGAIN" layout.
            if(phase === 'results') w.arcade.success = true
            w.arcade.render()
            const card = w.arcade.$panel.getBoundingClientRect()
            for(const x of [-24.5, -29, -35, -41, -47, -50])
            {
                object.position.x = x
                object.updateMatrixWorld(true)
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
                object.traverse(mesh =>
                {
                    if(!mesh.isMesh || !mesh.visible) return
                    if(!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
                    const bounds = mesh.geometry.boundingBox
                    for(const cx of [bounds.min.x, bounds.max.x]) for(const cy of [bounds.min.y, bounds.max.y]) for(const cz of [bounds.min.z, bounds.max.z])
                    {
                        const point = originalPosition.clone().set(cx, cy, cz).applyMatrix4(mesh.matrixWorld).project(w.camera.instance)
                        const px = (point.x + 1) * innerWidth / 2, py = (1 - point.y) * innerHeight / 2
                        minX = Math.min(minX, px); maxX = Math.max(maxX, px)
                        minY = Math.min(minY, py); maxY = Math.max(maxY, py)
                    }
                })
                if(maxX > card.left && minX < card.right && maxY > card.top && minY < card.bottom) overlaps.push({ phase, x })
            }
        }
    }
    finally { object.position.copy(originalPosition); w.arcade.state = originalState; w.arcade.success = originalSuccess; w.arcade.render(); w.time.resume() }
    check('Full car stays clear across six lane positions and all five round states', overlaps.length === 0, { overlaps })
    w.arcade.exit()
    w.visitorGuide.choose('projects')
    await frames(2)
    const samples = []
    const originalYaw = w.controls.getViewYaw
    let yaw = 0
    w.controls.getViewYaw = () => yaw
    for(let i = 0; i < 45; i++)
    {
        yaw += .025
        await frames(1)
        samples.push(w.visitorGuide.$bearing.style.transform)
    }
    w.controls.getViewYaw = originalYaw
    const changes = samples.slice(1).filter((s, i) => s !== samples[i]).length
    check('Guide bearing follows each rendered frame, not a 4 Hz timer', changes >= 40, { changes, frames: samples.length })
    const before = Array.from(w.visitorGuide.markers.instanceMatrix.array.slice(0, 16))
    w.physics.car.chassis.body.position.x += .4
    await frames(20)
    const after = Array.from(w.visitorGuide.markers.instanceMatrix.array.slice(0, 16))
    const player = w.explorer.renderPosition
    check('Street chevrons dynamically follow the smoothed visitor position', !before.every((v, i) => Math.abs(v - after[i]) < .001) && Math.abs(Math.hypot(after[12] - player.x, after[13] - player.y) - 2) < .01, { before: before.slice(12, 15), after: after.slice(12, 15) })
    w.visitorGuide.clear()
    return { passed: checks.every(c => c.passed), checks }
})()
