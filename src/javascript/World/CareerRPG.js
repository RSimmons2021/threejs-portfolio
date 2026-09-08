import * as THREE from 'three'
import createStorefront, { facingNormal } from './createStorefront.js'
import createApartment from './createApartment.js'
import { createPerson } from './Pedestrians.js'
import CareerNPCs from './CareerNPCs.js'
import { containment, findTheBeat, loadTest, sitTheEval } from './CareerGames.js'
import { BUILDINGS, MAX_FOCUS, MAX_STAT, NPCS, QUESTS, SHOP, STATS } from './careerData.js'

const STORAGE_KEY = 'rs-career-v1'

const BLANK = () => ({
    day: 1,
    focus: MAX_FOCUS,
    credits: 0,
    stats: { ai: 0, systems: 0, product: 0 },
    shifts: [],
    npcs: [],
    trained: [],
    owned: [],
    equipped: [],
    espresso: 0,
    quests: [],
    visited: [],
    containment: 0
})

/**
 * The walking layer's progression: stats, credits, a day counter, doors into
 * every employer and project on the resume, six people to talk to, a shop, and
 * one arcade cabinet. State survives reloads in localStorage and is only ever
 * advanced by doing something in the world.
 */
export default class CareerRPG
{
    constructor(_world)
    {
        this.world = _world
        this.container = new THREE.Group()
        this.container.name = 'Career layer'
        this.doors = new Map()
        this.zones = []
        this.game = null

        try { this.storage = window.localStorage } catch { this.storage = null }
        this.state = this.read()

        this.setInterface()
        this.setDoors()
        this.setDialog()
        this.npcs = new CareerNPCs(_world, this)
        this.container.add(this.npcs.container)

        this.applyCosmetics()
        this.syncDoorLocks()
        this.render()

        this.world.time.on('tick', () => this.updateVisibility())
        window.addEventListener('portfolio:navigate', () => this.close())
    }

    /* ---------------------------------------------------------------- state */

    read()
    {
        const blank = BLANK()
        try
        {
            const raw = JSON.parse(this.storage?.getItem(STORAGE_KEY) || 'null')
            if(!raw || typeof raw !== 'object') return blank
            // Merge field by field: a stored save from an older build must never
            // be able to remove a key the rest of this class assumes exists.
            return {
                ...blank,
                ...raw,
                stats: { ...blank.stats, ...(raw.stats || {}) },
                shifts: Array.isArray(raw.shifts) ? raw.shifts : [],
                npcs: Array.isArray(raw.npcs) ? raw.npcs : [],
                trained: Array.isArray(raw.trained) ? raw.trained : [],
                owned: Array.isArray(raw.owned) ? raw.owned : [],
                equipped: Array.isArray(raw.equipped) ? raw.equipped : [],
                quests: Array.isArray(raw.quests) ? raw.quests : [],
                visited: Array.isArray(raw.visited) ? raw.visited : []
            }
        }
        catch { return blank }
    }

    save()
    {
        try { this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state)) } catch {}
    }

    reset()
    {
        this.state = BLANK()
        this.save()
        this.applyCosmetics()
        this.syncDoorLocks()
        this.render()
        this.close()
        this.notify('Career reset. Day 1, nothing earned.', 'warning')
    }

    stat(_id) { return this.state.stats[_id] || 0 }

    meets(_requires)
    {
        if(!_requires) return true
        return Object.entries(_requires).every(([id, value]) => this.stat(id) >= value)
    }

    grant({ credits = 0, gain = null, focus = 0 })
    {
        if(credits) this.state.credits += credits
        if(focus) this.state.focus = Math.max(0, Math.min(MAX_FOCUS, this.state.focus + focus))
        if(gain) for(const [id, value] of Object.entries(gain))
        {
            this.state.stats[id] = Math.min(MAX_STAT, this.stat(id) + value)
        }
        this.save()
        this.syncDoorLocks()
        this.render()
    }

    notify(_message, _tone = 'project')
    {
        this.world.experienceDirector?.notify(_message, _tone)
    }

    /* -------------------------------------------------------------- quests */

    questDone(_id)
    {
        const s = this.state
        switch(_id)
        {
            case 'first-shift': return s.shifts.length > 0
            case 'all-employers': return BUILDINGS.filter((_b) => _b.kind === 'job')
                .every((_b) => _b.shifts.some((_shift) => s.shifts.includes(_shift.id)))
            case 'all-npcs': return NPCS.every((_npc) => s.npcs.includes(_npc.id))
            case 'trained': return STATS.every((_stat) => s.trained.includes(_stat.id))
            case 'sleep': return s.day > 1
            case 'purchase': return s.owned.length > 0
            case 'containment': return s.containment >= 100
            case 'agentlab': return s.visited.includes('agentlab')
            case 'agentrelay': return s.visited.includes('agentrelay')
            default: return false
        }
    }

    checkQuests()
    {
        for(const quest of QUESTS)
        {
            if(this.state.quests.includes(quest.id) || !this.questDone(quest.id)) continue
            this.state.quests.push(quest.id)
            this.notify(`Objective complete — ${quest.label}`, 'project')
        }
        this.save()
    }

    /* --------------------------------------------------------------- doors */

    setDoors()
    {
        for(const building of BUILDINGS)
        {
            const locked = !this.meets(building.requires)
            // A building with a `model` gets its Blender asset; everything else
            // gets the procedural storefront. Both expose the same userData API.
            const storefront = building.model === 'apartment'
                ? createApartment({
                    resources: this.world.resources,
                    materials: this.world.materials,
                    name: building.name,
                    sign: building.sign,
                    colour: building.colour,
                    facing: building.door.facing,
                    lighting: this.world.advancedLighting
                })
                : createStorefront({
                    materials: this.world.materials,
                    name: building.name,
                    sign: building.sign,
                    colour: building.colour,
                    facing: building.door.facing,
                    kind: building.kind,
                    locked
                })
            storefront.position.set(building.door.x, building.door.y, 0)
            this.container.add(storefront)

            // The interaction zone sits on the sidewalk in front of the facade,
            // never inside the building's own collision box.
            const normal = facingNormal(building.door.facing)
            const area = this.world.areas.add({
                position: new THREE.Vector2(building.door.x + normal.x * 2.1, building.door.y + normal.y * 2.1),
                halfExtents: new THREE.Vector2(2.3, 2.3)
            })
            area.on('interact', () => this.open(building))
            this.registerZone(area, building.name, () => this.open(building))

            this.doors.set(building.id, { building, storefront, area })
        }
    }

    // Touch devices have no E key, and tapping an area's floor patch is blocked
    // in first person, so every career zone also drives an on-screen prompt.
    registerZone(_area, _label, _run, _verb = 'Enter')
    {
        this.zones.push({ area: _area, label: _label, run: _run, verb: _verb })
    }

    syncDoorLocks()
    {
        for(const { building, storefront } of this.doors.values())
        {
            storefront.userData.setLocked(!this.meets(building.requires))
        }
        const minimap = this.world.minimap
        if(minimap)
        {
            // Reachable doors always show. The Site Map adds the locked ones,
            // so the purchase reveals what you still cannot get into.
            const hasMap = this.state.equipped.includes('sitemap')
            minimap.doors = BUILDINGS
                .filter((_b) => hasMap || this.meets(_b.requires))
                .map((_b) => ({
                    x: _b.door.x,
                    y: _b.door.y,
                    open: this.meets(_b.requires),
                    colour: _b.colour,
                    visited: this.state.visited.includes(_b.id)
                }))
            minimap.people = NPCS.map((_npc) => ({ x: _npc.position.x, y: _npc.position.y, met: this.state.npcs.includes(_npc.id) }))
        }
    }

    /* ----------------------------------------------------------- cosmetics */

    applyCosmetics()
    {
        // Worn, not merely owned: the bag decides what the walker has on.
        const owned = this.state.equipped
        const jacket = owned.includes('jacket') ? '#ff8a3d' : '#ffb627'
        const explorer = this.world.explorer
        if(!explorer) return

        const avatar = createPerson(this.world.materials, jacket)
        const cel = (hex) => this.world.materials.getCelMaterial(new THREE.Color(hex))
        const box = createPerson.box
        const part = (size, position, hex) =>
        {
            const mesh = new THREE.Mesh(box, cel(hex))
            mesh.scale.set(...size)
            mesh.position.set(...position)
            avatar.add(mesh)
        }

        if(owned.includes('hardhat')) part([0.4, 0.38, 0.11], [0, 0, 1.79], '#ffca62')
        if(owned.includes('headphones'))
        {
            part([0.44, 0.1, 0.07], [0, 0, 1.73], '#172334')
            part([0.08, 0.17, 0.17], [- 0.19, 0, 1.56], '#172334')
            part([0.08, 0.17, 0.17], [0.19, 0, 1.56], '#172334')
        }
        if(owned.includes('lanyard'))
        {
            part([0.2, 0.06, 0.24], [0, - 0.14, 1.3], '#86ded7')
            part([0.16, 0.05, 0.2], [0, - 0.16, 1.09], '#fff0d2')
        }

        // Swap the mesh in place so Explorer keeps driving the same reference.
        avatar.visible = explorer.avatar ? explorer.avatar.visible : false
        avatar.position.copy(explorer.avatar ? explorer.avatar.position : new THREE.Vector3())
        avatar.rotation.z = explorer.avatar ? explorer.avatar.rotation.z : 0
        if(explorer.avatar) this.world.container.remove(explorer.avatar)
        this.world.container.add(avatar)
        explorer.avatar = avatar
    }

    /* ------------------------------------------------------------------ UI */

    setInterface()
    {
        this.$panel = document.createElement('section')
        this.$panel.className = 'career-hud'
        this.$panel.setAttribute('aria-label', 'Career progress')
        this.$panel.innerHTML = `
            <div class="career-hud__top">
                <span class="career-hud__day" data-day>DAY 1</span>
                <span class="career-hud__credits"><strong data-credits>0</strong> cr</span>
                <button type="button" data-career="log" aria-expanded="false">Goals</button>
                <button type="button" data-career="bag" aria-expanded="false">Bag</button>
            </div>
            <div class="career-hud__focus"><i data-focus></i></div>
            <div class="career-hud__stats">${STATS.map((_stat) => `
                <div class="career-stat" data-stat="${_stat.id}" title="${_stat.blurb}">
                    <span>${_stat.label}</span>
                    <b data-bar><i></i></b>
                    <em data-value>0</em>
                </div>`).join('')}</div>
            <ol class="career-hud__log" data-log hidden></ol>
            <div class="career-hud__bag" data-bag hidden></div>`
        document.body.appendChild(this.$panel)

        this.$panel.addEventListener('click', (_event) =>
        {
            if(_event.target.closest('[data-career="log"]')) this.togglePanel('log')
            if(_event.target.closest('[data-career="bag"]')) this.togglePanel('bag')
            const equip = _event.target.closest('[data-equip]')
            if(equip) this.toggleEquip(equip.dataset.equip)
            const use = _event.target.closest('[data-use]')
            if(use) this.useItem(use.dataset.use)
        })

        this.$prompt = document.createElement('button')
        this.$prompt.type = 'button'
        this.$prompt.className = 'career-prompt'
        this.$prompt.hidden = true
        this.$prompt.addEventListener('click', () => this.nearest?.run())
        document.body.appendChild(this.$prompt)
    }

    // One drawer at a time: the HUD sits over the city and should not grow into
    // a wall of text.
    togglePanel(_which)
    {
        for(const name of ['log', 'bag'])
        {
            const $el = this.$panel.querySelector(`[data-${name}]`)
            const $button = this.$panel.querySelector(`[data-career="${name}"]`)
            const open = name === _which ? $el.hidden : false
            $el.hidden = !open
            $button.setAttribute('aria-expanded', String(open))
            $button.classList.toggle('is-on', open)
        }
        this.render()
    }

    toggleEquip(_id)
    {
        const item = SHOP.find((_item) => _item.id === _id)
        if(!item || !this.state.owned.includes(_id)) return
        const equipped = this.state.equipped
        if(equipped.includes(_id)) equipped.splice(equipped.indexOf(_id), 1)
        else
        {
            // One item per slot, so a hard hat and headphones cannot share a head.
            for(const other of SHOP)
            {
                if(other.slot && other.slot === item.slot && equipped.includes(other.id))
                    equipped.splice(equipped.indexOf(other.id), 1)
            }
            equipped.push(_id)
        }
        this.save()
        this.applyCosmetics()
        this.syncDoorLocks()
        this.render()
    }

    useItem(_id)
    {
        if(_id !== 'espresso' || this.state.espresso < 1) return
        this.state.espresso -= 1
        this.state.focus = Math.min(MAX_FOCUS, this.state.focus + 40)
        this.save()
        this.notify(`Espresso. +40 focus, ${this.state.espresso} left.`, 'project')
        this.render()
        this.renderFoot()
    }

    render()
    {
        this.checkQuests()
        const s = this.state
        this.$panel.querySelector('[data-day]').textContent = `DAY ${s.day}`
        this.$panel.querySelector('[data-credits]').textContent = s.credits
        this.$panel.querySelector('[data-focus]').style.transform = `scaleX(${s.focus / MAX_FOCUS})`
        this.$panel.querySelector('.career-hud__focus').dataset.low = String(s.focus < 20)

        for(const stat of STATS)
        {
            const $stat = this.$panel.querySelector(`[data-stat="${stat.id}"]`)
            $stat.querySelector('[data-bar] i').style.transform = `scaleX(${this.stat(stat.id) / MAX_STAT})`
            $stat.querySelector('[data-value]').textContent = this.stat(stat.id)
        }

        const $bag = this.$panel.querySelector('[data-bag]')
        if(!$bag.hidden)
        {
            const owned = SHOP.filter((_item) => s.owned.includes(_item.id) || (_item.id === 'espresso' && s.espresso > 0))
            $bag.innerHTML = owned.length
                ? owned.map((_item) =>
                {
                    if(_item.kind === 'consumable')
                        return `<div class="career-bag__item"><span>${_item.name} ×${s.espresso}</span>
                            <button type="button" data-use="${_item.id}"${s.espresso ? '' : ' disabled'}>Use</button></div>`
                    const on = s.equipped.includes(_item.id)
                    return `<div class="career-bag__item" data-on="${on}"><span>${_item.name}</span>
                        <button type="button" data-equip="${_item.id}">${on ? 'Worn' : 'Wear'}</button></div>`
                }).join('')
                : '<p class="career-bag__empty">Nothing yet. Supply is north of the start, past the Home Lab.</p>'
        }

        this.$panel.querySelector('[data-log]').innerHTML = QUESTS.map((_quest) =>
        {
            const done = s.quests.includes(_quest.id)
            return `<li data-done="${done}"><span>${done ? '✓' : '○'}</span><div><strong>${_quest.label}</strong>${done ? '' : `<em>${_quest.hint}</em>`}</div></li>`
        }).join('')
    }

    updateVisibility()
    {
        // The career layer belongs to the walking mode; driving keeps its own HUD.
        const onFoot = Boolean(this.world.explorer?.active)
        const blocked = this.world.arcade?.state !== 'idle'
        const show = onFoot && !blocked
        if(show !== this.shown)
        {
            this.shown = show
            this.$panel.classList.toggle('is-visible', show)
        }

        const zone = show && !this.$dialog.open ? this.zones.find((_zone) => _zone.area.isIn) : null
        if(zone !== this.nearest)
        {
            this.nearest = zone
            this.$prompt.hidden = !zone
            // No key hint on touch: there is no keyboard to press E on.
            if(zone) this.$prompt.innerHTML = `${zone.verb || 'Enter'} <strong>${zone.label}</strong>`
                + (this.world.config.touch ? '' : '<kbd>E</kbd>')
        }

        // config.touch only flips on the first real touchstart, so mirror it onto
        // the body for the CSS that hides keyboard hints.
        const touch = Boolean(this.world.config.touch)
        if(touch !== this.touchInput)
        {
            this.touchInput = touch
            document.body.classList.toggle('is-touch-input', touch)
            if(this.nearest) this.$prompt.innerHTML = `${this.nearest.verb || 'Enter'} <strong>${this.nearest.label}</strong>`
                + (touch ? '' : '<kbd>E</kbd>')
        }

        const elapsed = this.world.time.elapsed / 1000
        for(const { storefront } of this.doors.values()) storefront.userData.update?.(elapsed)

        const firstPerson = Boolean(this.world.camera.firstPerson)
        if(firstPerson !== this.firstPersonView)
        {
            this.firstPersonView = firstPerson
            for(const { storefront } of this.doors.values()) storefront.userData.setView(firstPerson)
            this.npcs.setView(firstPerson)
        }
    }

    /* -------------------------------------------------------------- dialog */

    setDialog()
    {
        this.$dialog = document.createElement('dialog')
        this.$dialog.className = 'career-dialog'
        this.$dialog.innerHTML = `
            <header class="career-dialog__head">
                <p class="career-dialog__eyebrow" data-eyebrow></p>
                <h2 data-title></h2>
                <p class="career-dialog__intro" data-intro></p>
                <button type="button" class="career-dialog__close" data-career="close">Close <kbd>Esc</kbd></button>
            </header>
            <div class="career-dialog__body" data-body></div>
            <footer class="career-dialog__foot" data-foot></footer>`
        document.body.appendChild(this.$dialog)

        this.$body = this.$dialog.querySelector('[data-body]')
        this.$foot = this.$dialog.querySelector('[data-foot]')

        this.$dialog.addEventListener('click', (_event) =>
        {
            if(_event.target.closest('[data-career="close"]')) this.close()
        })
        // A queued close event can land after the dialog has already been
        // reopened (close then immediately open, which Esc-then-E does). Releasing
        // then would destroy the new session's running game, so check first.
        this.$dialog.addEventListener('close', () => { if(!this.$dialog.open) this.release() })
    }

    open(_building)
    {
        if(this.$dialog.open || this.world.arcade?.state !== 'idle') return

        // A building with a modelled interior is walked into, not read about.
        // This has to come before the interaction lock: the lock freezes the
        // walker for a dialog, and there is no dialog to release it here.
        if(_building.kind === 'home' && this.world.interiors)
        {
            this.world.interiors.enter(_building)
            if(!this.state.visited.includes(_building.id))
            {
                this.state.visited.push(_building.id)
                this.save()
            }
            return
        }

        this.building = _building
        this.world.experienceDirector?.setInteractionLock('career', true)
        document.body.classList.add('has-career-dialog')

        const locked = !this.meets(_building.requires)
        this.$dialog.querySelector('[data-eyebrow]').textContent = _building.eyebrow || ''
        this.$dialog.querySelector('[data-title]').innerHTML = `${_building.name}<span>${_building.sign}</span>`
        this.$dialog.querySelector('[data-intro]').textContent = locked
            ? 'The door is locked. Build the record that gets you in.'
            : _building.intro || ''

        if(!this.state.visited.includes(_building.id) && !locked)
        {
            this.state.visited.push(_building.id)
            this.save()
        }

        if(locked) this.renderLocked(_building)
        else if(_building.kind === 'job') this.renderJob(_building)
        else if(_building.kind === 'trainer') this.renderTrainer(_building)
        else if(_building.kind === 'home') this.renderHome()
        else if(_building.kind === 'shop') this.renderShop()
        else if(_building.kind === 'arcade') this.renderArcade()
        else if(_building.kind === 'project') this.renderProject(_building)

        this.renderFoot()
        this.$dialog.showModal()
        this.$dialog.scrollTop = 0
        this.render()
    }

    openNPC(_npc)
    {
        if(this.$dialog.open || this.world.arcade?.state !== 'idle') return
        this.building = null
        this.world.experienceDirector?.setInteractionLock('career', true)
        document.body.classList.add('has-career-dialog')

        const first = !this.state.npcs.includes(_npc.id)
        this.$dialog.querySelector('[data-eyebrow]').textContent = _npc.role
        this.$dialog.querySelector('[data-title]').innerHTML = `${_npc.name}<span></span>`
        this.$dialog.querySelector('[data-intro]').textContent = ''
        this.$body.innerHTML = `<div class="career-talk">${_npc.lines.map((_line) =>
            `<p${_line.startsWith('"') ? '' : ' class="career-talk__aside"'}>${_line}</p>`).join('')}</div>`

        if(first)
        {
            this.state.npcs.push(_npc.id)
            this.grant({ credits: _npc.credits, gain: _npc.gain })
            this.syncDoorLocks()
            const gained = Object.entries(_npc.gain || {}).map(([id, v]) => `+${v} ${id.toUpperCase()}`).join(' · ')
            this.$body.insertAdjacentHTML('beforeend', `<p class="career-reward">+${_npc.credits} cr${gained ? ` · ${gained}` : ''}</p>`)
        }

        this.renderFoot()
        this.$dialog.showModal()
        this.$dialog.scrollTop = 0
        this.render()
    }

    close()
    {
        // The dialog's own "close" event is queued, not synchronous, so release
        // here too: a lock that outlives the dialog leaves the walker frozen.
        if(this.$dialog.open) this.$dialog.close()
        this.release()
    }

    release()
    {
        this.game?.destroy()
        this.game = null
        this.building = null
        document.body.classList.remove('has-career-dialog')
        this.world.experienceDirector?.setInteractionLock('career', false)
    }

    renderFoot()
    {
        const s = this.state
        this.$foot.innerHTML = `DAY ${s.day} · ${s.credits} cr · FOCUS ${s.focus}/${MAX_FOCUS}
            · AI ${this.stat('ai')} · SYS ${this.stat('systems')} · PRD ${this.stat('product')}`
    }

    /* -------------------------------------------------------- dialog views */

    renderLocked(_building)
    {
        const rows = Object.entries(_building.requires).map(([id, value]) =>
        {
            const have = this.stat(id)
            return `<li data-met="${have >= value}"><span>${id.toUpperCase()}</span><b>${have} / ${value}</b></li>`
        }).join('')
        this.$body.innerHTML = `
            <p class="career-game__lede">This project opens once the record behind it exists.</p>
            <ul class="career-requires">${rows}</ul>
            <p class="career-game__note">Shifts and trainers both raise stats. The Eval Lab is the fastest route to AI.</p>`
    }

    renderJob(_building)
    {
        this.$body.innerHTML = `<div class="career-shifts">${_building.shifts.map((_shift) =>
        {
            const done = this.state.shifts.includes(_shift.id)
            const affordable = this.state.focus >= _shift.focus
            const gains = Object.entries(_shift.gain).map(([id, v]) => `+${v} ${id.toUpperCase()}`).join(' · ')
            return `
                <article class="career-shift" data-done="${done}">
                    <h3>${_shift.title}</h3>
                    <p>${_shift.body}</p>
                    <div class="career-shift__foot">
                        <span>${done ? 'WORKED' : `${_shift.focus} focus → +${_shift.credits} cr · ${gains}`}</span>
                        ${done ? '' : `<button type="button" data-shift="${_shift.id}"${affordable ? '' : ' disabled'}>${affordable ? 'Work the shift' : 'Not enough focus'}</button>`}
                    </div>
                </article>`
        }).join('')}</div>`

        this.$body.querySelectorAll('[data-shift]').forEach(($button) =>
        {
            $button.addEventListener('click', () => this.workShift(_building, $button.dataset.shift))
        })
    }

    workShift(_building, _id)
    {
        const shift = _building.shifts.find((_shift) => _shift.id === _id)
        if(!shift || this.state.shifts.includes(_id) || this.state.focus < shift.focus) return
        this.state.shifts.push(_id)
        this.state.focus -= shift.focus
        this.grant({ credits: shift.credits, gain: shift.gain })
        const gains = Object.entries(shift.gain).map(([id, v]) => `+${v} ${id.toUpperCase()}`).join(' · ')
        this.notify(`${shift.title} — +${shift.credits} cr · ${gains}`, 'project')
        this.renderJob(_building)
        this.renderFoot()
    }

    renderTrainer(_building)
    {
        const affordable = this.state.focus >= _building.trainer.focus
        this.$body.innerHTML = `
            <p class="career-game__lede">${_building.trainer.body}</p>
            <p class="career-game__note">${_building.trainer.focus} focus · pass for +1 ${_building.stat.toUpperCase()} and 25 cr.</p>
            <div class="career-actions">
                <button type="button" data-train${affordable ? '' : ' disabled'}>${affordable ? _building.trainer.verb : 'Not enough focus'}</button>
            </div>`

        this.$body.querySelector('[data-train]')?.addEventListener('click', () =>
        {
            if(this.state.focus < _building.trainer.focus) return
            this.state.focus -= _building.trainer.focus
            this.save()
            this.renderFoot()
            const $host = document.createElement('div')
            $host.className = 'career-game'
            this.$body.innerHTML = ''
            this.$body.appendChild($host)

            const done = (_passed, _summary) => this.finishTraining(_building, _passed, _summary)
            const runner = _building.stat === 'systems' ? loadTest : _building.stat === 'product' ? findTheBeat : sitTheEval
            this.game = runner($host, done)
        })
    }

    finishTraining(_building, _passed, _summary)
    {
        this.game?.destroy()
        this.game = null
        if(_passed)
        {
            if(!this.state.trained.includes(_building.stat)) this.state.trained.push(_building.stat)
            this.grant({ credits: 25, gain: { [_building.stat]: 1 } })
            this.notify(`${_building.name} — +1 ${_building.stat.toUpperCase()} · +25 cr`, 'project')
        }
        else this.save()

        this.$body.innerHTML = `
            <p class="career-result" data-passed="${_passed}">${_passed ? 'PASS' : 'NO PASS'}</p>
            <p class="career-game__lede">${_summary}</p>
            <div class="career-actions"><button type="button" data-again>Train again</button></div>`
        this.$body.querySelector('[data-again]').addEventListener('click', () =>
        {
            this.renderTrainer(_building)
            this.renderFoot()
        })
        this.render()
        this.renderFoot()
    }

    sleep()
    {
        this.state.day += 1
        this.state.focus = MAX_FOCUS
        this.save()
        this.notify(`Day ${this.state.day}. Focus restored.`, 'project')
        this.render()
    }

    openHomeLab()
    {
        const building = BUILDINGS.find((_b) => _b.kind === 'home')
        if(!building || this.$dialog.open) return
        this.building = building
        this.world.experienceDirector?.setInteractionLock('career', true)
        document.body.classList.add('has-career-dialog')
        this.$dialog.querySelector('[data-eyebrow]').textContent = building.eyebrow
        this.$dialog.querySelector('[data-title]').innerHTML = `${building.name}<span>${building.sign}</span>`
        this.$dialog.querySelector('[data-intro]').textContent = building.intro
        this.renderHome()
        this.renderFoot()
        this.$dialog.showModal()
        this.render()
    }

    renderHome()
    {
        this.$body.innerHTML = `
            <p class="career-game__lede">Focus is ${this.state.focus} of ${MAX_FOCUS}. Sleeping restores it and starts day ${this.state.day + 1}.</p>
            <p class="career-game__note">Music producer, 10+ years. Design obsessive: Dieter Rams, Zaha Hadid, Grasshopper. This is the room where the side of the resume nobody asks about actually lives.</p>
            <div class="career-actions">
                <button type="button" data-sleep>Sleep until morning</button>
                <button type="button" class="is-quiet" data-reset>Reset career</button>
            </div>`

        this.$body.querySelector('[data-sleep]').addEventListener('click', () =>
        {
            this.sleep()
            this.renderHome()
            this.renderFoot()
        })
        this.$body.querySelector('[data-reset]').addEventListener('click', () => this.reset())
    }

    renderShop()
    {
        this.$body.innerHTML = `<div class="career-shop">${SHOP.map((_item) =>
        {
            const owned = this.state.owned.includes(_item.id)
            const consumable = _item.kind === 'consumable'
            const affordable = this.state.credits >= _item.cost
            const label = owned && !consumable ? 'Owned' : affordable ? `Buy · ${_item.cost} cr` : `${_item.cost} cr`
            return `
                <article class="career-item" data-owned="${owned && !consumable}">
                    <h3>${_item.name}</h3>
                    <p>${_item.detail}</p>
                    <button type="button" data-buy="${_item.id}"${(owned && !consumable) || !affordable ? ' disabled' : ''}>${label}</button>
                </article>`
        }).join('')}</div>`

        this.$body.querySelectorAll('[data-buy]').forEach(($button) =>
        {
            $button.addEventListener('click', () => this.buy($button.dataset.buy))
        })
    }

    buy(_id)
    {
        const item = SHOP.find((_item) => _item.id === _id)
        if(!item || this.state.credits < item.cost) return
        if(item.kind !== 'consumable' && this.state.owned.includes(_id)) return

        this.state.credits -= item.cost
        if(item.kind === 'consumable')
        {
            this.state.espresso += 1
            if(!this.state.owned.includes(_id)) this.state.owned.push(_id)
            this.notify(`Espresso in the bag. ${this.state.espresso} on hand.`, 'project')
        }
        else
        {
            this.state.owned.push(_id)
            // Wear it straight away; the bag can take it off again.
            this.toggleEquip(_id)
            this.notify(`${item.name} acquired and worn.`, 'project')
        }

        this.save()
        this.applyCosmetics()
        this.syncDoorLocks()
        this.renderShop()
        this.renderFoot()
        this.render()
    }

    renderArcade()
    {
        this.$body.innerHTML = `
            <p class="career-game__lede">Read the call against the manifest and rule on it. One wrong ruling ends the run — a permission layer that is right most of the time is not one.</p>
            <p class="career-game__note">Best containment: ${this.state.containment}%. Clear the board for +2 AI and 60 cr.</p>
            <div class="career-actions"><button type="button" data-play>Insert credit</button></div>`

        this.$body.querySelector('[data-play]').addEventListener('click', () => this.startContainment())
    }

    startContainment()
    {
        const $host = document.createElement('div')
        $host.className = 'career-game'
        this.$body.innerHTML = ''
        this.$body.appendChild($host)
        this.game = containment($host, (_passed, _summary) => this.finishArcade(_passed, _summary))
    }

    finishArcade(_passed, _summary)
    {
        this.game?.destroy()
        this.game = null
        if(_passed)
        {
            const first = this.state.containment < 100
            this.state.containment = 100
            if(first) this.grant({ credits: 60, gain: { ai: 2 } })
            else this.grant({ credits: 15 })
            this.notify(first ? 'Containment 100% — +2 AI · +60 cr' : 'Containment held. +15 cr', 'project')
        }
        else this.save()

        this.$body.innerHTML = `
            <p class="career-result" data-passed="${_passed}">${_passed ? 'CONTAINED' : 'BREACH'}</p>
            <p class="career-game__lede">${_summary}</p>
            <div class="career-actions"><button type="button" data-again>Insert another credit</button></div>`
        this.$body.querySelector('[data-again]').addEventListener('click', () => this.startContainment())
        this.render()
        this.renderFoot()
    }

    renderProject(_building)
    {
        this.$body.innerHTML = `
            <div class="career-panels">${_building.panels.map((_panel) => `<p>${_panel}</p>`).join('')}</div>
            <div class="career-actions"><a href="${_building.url}" target="_blank" rel="noopener">Open the live project ↗</a></div>`
    }
}
