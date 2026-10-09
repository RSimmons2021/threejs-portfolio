// Real interaction/animation regression checks after ENTER SITE.
(async () => {
    const w = application.world, e = w.explorer, h = w.hoverFlight, m = w.miniGames, r = w.careerRPG
    const car = w.physics.car.chassis.body, results = []
    const check = (label, ok) => { if(!ok) throw Error(label); results.push(label) }
    const wait = async predicate => {
        const deadline = performance.now() + 15000
        while(!predicate()) { if(performance.now() > deadline) throw Error('Readiness timeout'); await new Promise(requestAnimationFrame) }
    }
    await wait(() => w.neonCrowd.ready)
    m.destroy(); r.close(); w.arcade.exit(false); e.enterCar(true); h.forceLand()
    car.position.set(0, -15, 0.6); car.velocity.set(0, 0, 0)
    e.exitCar(); e.setSkating(true)
    e.update()
    check('Rider is raised to the grip tape, board stays on the ground', Math.abs(e.avatar.position.z - e.board.position.z - 0.135) < 0.001)
    check('No whole-avatar lean lifts the boots', e.avatar.rotation.x === 0)
    const skin = e.avatar.getObjectByProperty('type', 'SkinnedMesh')
    const head = skin.skeleton.bones.find(b => b.name === 'head')
    const up = e.lookTarget.clone().set(0, 1, 0).applyQuaternion(head.getWorldQuaternion(e.avatar.quaternion.clone()))
    check('Head stays upright while skating', up.z > 0.9999)
    check('Player-only lights are green', skin.material.defines.PLAYER_LIGHT === 1 && skin.material.uniforms.uPlayerLight.value.g > 0.9)
    check('Crowd material is unchanged', !w.neonCrowd.mesh.material.defines.PLAYER_LIGHT && w.neonCrowd.mesh.material !== skin.material)
    e.setSkating(false); e.enterCar(true)
    const project = w.sections.projects.items[0], area = project.floor.area
    h.takeOff(); h.mode = 'flying'; h.yaw = 0
    car.position.set(area.position.x, area.position.y, 40); car.velocity.set(0, 0, 0)
    await new Promise(requestAnimationFrame)
    w.entryBeacons.update()
    check('Sky light columns use only two instanced draws', w.entryBeacons.meshes.length === 2 && w.entryBeacons.meshes.every(mesh => mesh.isInstancedMesh))
    check('Light columns do not create collision bodies', !w.physics.world.bodies.some(b => b.collisionRole === 'entry-beacon'))
    check('Project zone detects aerial entry', area.isIn && area.contains(e.position, true))
    check('Flying visitors have a touch/click Enter button', !w.entryBeacons.$prompt.hidden && w.entryBeacons.nearest === area)
    check('NPCs and indoor stations reject flying visitors', w.areas.items.filter(a => a.hasKey && !a.skyAccess).every(a => !a.contains(e.position, true)))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }))
    check('E still climbs without opening a project', h.keys.climb && !w.experienceDirector.$portal.open)
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true }))
    check('Enter opens the project from 40 m altitude', w.experienceDirector.$portal.open && w.experienceDirector.portal.project === project)
    const motion = w.config.reducedMotion
    w.config.reducedMotion = true; w.experienceDirector.closePortal(); w.config.reducedMotion = motion
    await new Promise(requestAnimationFrame)
    check('Closing the project preserves flight', h.airborne && car.position.z > 39)
    w.entryBeacons.update(); w.entryBeacons.$prompt.click()
    check('Touch Enter button opens the same aerial project', w.experienceDirector.$portal.open)
    w.config.reducedMotion = true; w.experienceDirector.closePortal(); w.config.reducedMotion = motion
    await new Promise(requestAnimationFrame)
    for(const id of ['shipIt', 'packetRun']) {
        const altitude = car.position.z
        m.start(id, () => {}); await wait(() => m.state === 'ready')
        await new Promise(requestAnimationFrame)
        m.destroy()
        check(`${id} restores a sky visitor's altitude and flight mode`, !e.active && h.mode === 'flying' && Math.abs(car.position.z - altitude) < 0.05 && car.velocity.z === 0)
    }
    car.position.x += 20
    w.entryBeacons.update()
    check('Aerial Enter button hides on leaving the column', w.entryBeacons.$prompt.hidden)
    h.forceLand(); car.position.set(0, -15, 0.6); car.velocity.set(0, 0, 0)
    w.guidedTour.clearControls(); e.updateInterface()
    return results
})()
