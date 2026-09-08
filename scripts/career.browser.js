// Run after entering the site:
// npx agent-browser --session explorer eval --stdin < scripts/career.browser.js
//
// Covers the walking-mode career layer end to end except the timed minigames,
// whose resolution is driven by setTimeout and needs an async driver.
(() => {
    const w = window.application.world
    const e = w.explorer
    const r = w.careerRPG
    const results = []
    const check = (name, condition) => { if(!condition) throw new Error(name); results.push(name) }
    const at = (id) => { const d = r.doors.get(id); e.body.position.set(d.area.position.x, d.area.position.y, 0.6); return d }

    r.reset()
    if(!e.active) e.exitCar()
    check('Walker is on foot', e.active)
    check('Every resume door exists', r.doors.size === 12)
    check('Every street NPC exists', r.npcs.people.length === 6)
    check('Career starts at day 1 with nothing earned', r.state.day === 1 && r.state.credits === 0 && r.stat('ai') === 0)

    // Proximity, prompt, and the E key all reach the same door
    const toyota = at('toyota')
    w.time.trigger('tick')
    check('Door zone detects the walker', toyota.area.isIn)
    r.updateVisibility()
    check('Entry prompt names the door', !r.$prompt.hidden && r.$prompt.textContent.includes('TOYOTA'))
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', code: 'KeyE', bubbles: true }))
    check('E opens the door', r.$dialog.open)
    check('Dialog locks the walker while reading', e.blocked && w.experienceDirector.locks.has('career'))
    check('Toyota offers four shifts', r.$dialog.querySelectorAll('[data-shift]').length === 4)

    // Working a shift spends focus and pays out
    const before = { credits: r.state.credits, product: r.stat('product'), focus: r.state.focus }
    r.$dialog.querySelector('[data-shift="toyota-ux"]').click()
    check('Shift pays credits', r.state.credits === before.credits + 45)
    check('Shift raises the mapped stat', r.stat('product') === before.product + 2)
    check('Shift spends focus', r.state.focus === before.focus - 20)
    check('Shift cannot be worked twice', !r.$dialog.querySelector('[data-shift="toyota-ux"]'))
    check('First-shift objective logged', r.state.quests.includes('first-shift'))

    r.close()
    check('Closing releases the lock synchronously', !r.$dialog.open && !e.blocked && !w.experienceDirector.locks.has('career'))

    // NPCs pay exactly once
    const recruiter = r.zones.find((z) => z.label === 'THE RECRUITER')
    recruiter.run()
    check('NPC dialog opens', r.$dialog.open)
    const afterTalk = r.state.credits
    r.close(); recruiter.run(); r.close()
    check('NPC pays only on the first conversation', r.state.credits === afterTalk)

    // Stat gates
    const lab = r.doors.get('agentlab')
    check('Agent Lab is locked below AI 5', !r.meets(lab.building.requires))
    at('agentlab').area.interact()
    check('Locked door shows requirements, not content', !!r.$dialog.querySelector('.career-requires') && !r.$dialog.querySelector('.career-panels'))
    check('Locked door is not recorded as visited', !r.state.visited.includes('agentlab'))
    r.close()
    r.grant({ gain: { ai: 5 } })
    check('Agent Lab unlocks at AI 5', r.meets(lab.building.requires))
    at('agentlab').area.interact()
    check('Unlocked door shows the project panels', !!r.$dialog.querySelector('.career-panels'))
    check('Project links to the live build', r.$dialog.querySelector('a[target]').href.includes('ai-agent-portal-site'))
    r.close()
    check('Agent Relay still needs SYSTEMS', !r.meets(r.doors.get('agentrelay').building.requires))

    // Shop, cosmetics, and the site map
    r.state.credits = 300; r.save()
    at('supply').area.interact()
    const partsBefore = e.avatar.children.length
    r.$dialog.querySelector('[data-buy="headphones"]').click()
    check('Purchase deducts credits', r.state.credits === 220)
    check('Purchase rebuilds the avatar with the cosmetic', e.avatar.children.length > partsBefore)
    check('Owned cosmetics cannot be rebought', r.$dialog.querySelector('[data-buy="headphones"]').disabled)
    r.$dialog.querySelector('[data-buy="sitemap"]').click()
    check('Site map marks every door on the minimap', w.minimap.doors.length === 12)
    r.close()

    // Sleep advances the day and restores focus
    r.state.focus = 10; r.save()
    at('homelab').area.interact()
    r.$dialog.querySelector('[data-sleep]').click()
    check('Sleep advances the day', r.state.day === 2)
    check('Sleep restores focus', r.state.focus === 100)
    r.close()

    // Persistence
    check('State round-trips through localStorage', JSON.stringify(r.read()) === JSON.stringify(r.state))

    // The HUD belongs to walking mode only
    r.updateVisibility()
    const onFoot = document.querySelector('.career-hud').classList.contains('is-visible')
    e.enterCar(true)
    r.updateVisibility()
    check('HUD shows on foot and hides while driving', onFoot && !document.querySelector('.career-hud').classList.contains('is-visible'))
    check('Prompt hides while driving', r.$prompt.hidden)

    r.reset()
    return results
})()
