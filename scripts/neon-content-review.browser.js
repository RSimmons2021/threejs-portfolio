// Manual, fixed-view review helpers. These intentionally freeze game time.
(() => {
    const w = application.world, r = w.careerRPG, m = w.miniGames
    const updateGameCamera = m.updateCamera.bind(m)
    m.updateCamera = () => {
        if(m.active) return updateGameCamera()
        if(!window.contentReviewPose) return
        const camera = w.camera.instance
        camera.position.copy(contentReviewPose.p); camera.quaternion.copy(contentReviewPose.q); camera.updateMatrixWorld()
    }
    window.reviewMiniGame = async id => {
        m.destroy(); r.close()
        m.start(id, () => {})
        await new Promise((resolve, reject) => {
            const deadline = performance.now() + 15000
            const frame = () => {
                if(m.state === 'ready') return resolve()
                if(performance.now() > deadline) return reject(Error('Review arena failed to load'))
                requestAnimationFrame(frame)
            }
            frame()
        })
        m.begin(); m.countdown = 0; m.update(); m.game.update(0)
        m.pause(); m.game.update(0)
        m.updateCamera()
        return { game: id, draws: w.renderer.info.render.calls }
    }
    window.reviewProjectBoards = (night = false) => {
        m.destroy(); r.close()
        w.dayNightCycle.settings.realTime = false
        w.dayNightCycle.settings.currentTime = night ? 23 / 24 : 13 / 24
        const director = w.experienceDirector
        director.setInteractionLock('content-review', true)
        w.camera.targetOverride = { x: 30, y: -25, z: 3 }
        const camera = w.camera.instance
        camera.position.set(30, -39, 7)
        camera.lookAt(30, -23, 4); camera.updateMatrixWorld()
        window.contentReviewPose = { p: camera.position.clone(), q: camera.quaternion.clone() }
        w.time.on('tick.contentReview', () => {
            if(m.active || !window.contentReviewPose) return
            camera.position.copy(contentReviewPose.p); camera.quaternion.copy(contentReviewPose.q); camera.updateMatrixWorld()
        })
        return 'Project Avenue review ready'
    }
    window.reviewSkater = () => {
        m.destroy(); r.close(); w.arcade.exit(false); w.hoverFlight.forceLand()
        const e = w.explorer, car = w.physics.car.chassis.body
        e.enterCar(true); car.position.set(0, -17, 0.6); car.velocity.set(0, 0, 0)
        w.experienceDirector.setInteractionLock('content-review', false)
        e.exitCar(); e.body.position.set(0, -15, 0.4); e.body.velocity.set(0, 0, 0)
        e.avatar.rotation.z = 0; e.setSkating(true); e.update()
        w.experienceDirector.setInteractionLock('content-review', true)
        const camera = w.camera.instance
        camera.position.set(2.1, -11.8, 1.9); camera.lookAt(0, -15, 0.9); camera.updateMatrixWorld()
        window.contentReviewPose = { p: camera.position.clone(), q: camera.quaternion.clone() }
        return 'Green-lit skater / fixed foot contacts'
    }
    window.reviewSkyEntry = () => {
        m.destroy(); r.close(); w.arcade.exit(false); w.explorer.enterCar(true)
        w.experienceDirector.setInteractionLock('content-review', false)
        const area = w.sections.projects.items[0].floor.area, car = w.physics.car.chassis.body
        w.hoverFlight.takeOff(true); w.hoverFlight.mode = 'flying'
        car.position.set(area.position.x, area.position.y, 40); car.velocity.set(0, 0, 0)
        w.physics.car.oldPosition?.copy(car.position)
        w.camera.targetOverride = w.explorer.lookTarget.clone().set(area.position.x, area.position.y, 40)
        const camera = w.camera.instance
        camera.position.set(area.position.x + 6, area.position.y - 10, 44)
        camera.lookAt(area.position.x, area.position.y, 40); camera.updateMatrixWorld()
        window.contentReviewPose = { p: camera.position.clone(), q: camera.quaternion.clone() }
        w.entryBeacons.update()
        return 'Aerial column entry at 40 m'
    }
    return 'reviewMiniGame(id), reviewProjectBoards(night)'
})()
