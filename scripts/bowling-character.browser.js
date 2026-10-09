// Run after entering the city; validates real collision audio and saved cosmetics.
(async () =>
{
    const w = window.application.world, r = w.careerRPG
    const frames = async count => { for(let i = 0; i < count; i++) await new Promise(requestAnimationFrame) }
    const deadline = performance.now() + 15000
    while(!w.explorer.avatar.userData.cyberPlayer)
    {
        if(performance.now() > deadline) throw new Error('Player asset did not finish loading')
        await frames(1)
    }
    const checks = []
    const check = (name, passed, detail) => checks.push({ name, passed: !!passed, detail })
    const originalState = structuredClone(r.state), originalStorage = r.storage
    try
    {
        const save = { ...originalState, owned: [...new Set([...originalState.owned, 'headphones'])], equipped: ['headphones'] }
        r.storage = { getItem: () => JSON.stringify(save) }
        const migrated = r.read()
        check('Old saves retain their headphone keepsake but stop wearing it', migrated.owned.includes('headphones') && !migrated.equipped.includes('headphones'))
        r.storage = null
        r.state.equipped = []
        r.applyCosmetics()
        const plainCount = w.explorer.avatar.children.length
        r.state.owned = save.owned
        r.state.equipped = ['headphones']
        r.applyCosmetics()
        check('Even stale in-memory equipment cannot add headphone geometry', w.explorer.avatar.children.length === plainCount)
        const skin = w.explorer.avatar.getObjectByProperty('type', 'SkinnedMesh')
        check('Character rig and green accents remain intact', skin.skeleton.bones.length === 15 && skin.material.defines.PLAYER_LIGHT === 1)
    }
    finally
    {
        r.storage = originalStorage
        r.state = originalState
        r.applyCosmetics()
        r.render()
    }
    const pinSound = w.sounds.items.find(item => item.name === 'bowlingPin')
    const ballSound = w.sounds.items.find(item => item.name === 'bowlingBall')
    check('Distinct ElevenLabs impact samples are loaded', pinSound.sounds[0].state() === 'loaded' && ballSound.sounds[0].state() === 'loaded')
    check('Bowling audio uses natural pitch and limits collision bursts', [pinSound, ballSound].every(item => item.rateMin >= .9 && item.rateMax <= 1.1 && item.minDelta >= 80))
    const originalPlay = w.sounds.play
    const calls = []
    w.sounds.play = function(name, velocity) { if(name === 'bowlingPin' || name === 'bowlingBall') calls.push({ name, velocity }); return originalPlay.call(this, name, velocity) }
    try
    {
        w.arcade.start('bowling')
        const ball = w.sections.playground.bowling.ball.collision.body
        ball.position.set(-43, -45, .6)
        ball.velocity.set(-10, 0, 0)
        ball.wakeUp()
        await frames(90)
        check('Real ball/pin contacts dispatch the impact sounds', ['bowlingPin', 'bowlingBall'].every(name => calls.some(c => c.name === name && c.velocity > 1)), { impacts: calls.filter(c => c.velocity > 1).length })
        check('Collision bursts cannot build unbounded audio voices', [pinSound, ballSound].every(item => item.voices.size <= item.maxConcurrent))
    }
    finally { w.sounds.play = originalPlay; w.arcade.exit() }
    return { passed: checks.every(c => c.passed), checks }
})()
