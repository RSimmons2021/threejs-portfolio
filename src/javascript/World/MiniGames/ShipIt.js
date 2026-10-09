import { shipStep } from './rules.js'
import * as THREE from 'three'

export default class ShipIt
{
    constructor(run)
    {
        this.run = run; this.title = 'Ship It'
        this.instructions = 'Move WASD / arrows; Shift toggles skate. Walk into an app orb, then hold E / WORK at CODE, both BUILD stations, and REVIEW. Clear amber webhooks at PAYMENTS before review. Follow the next station in the HUD. Ship both apps in 120s.'
        this.controls = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map((hold, i) => ({ hold, label: ['UP ↑', 'LEFT ←', 'DOWN ↓', 'RIGHT →'][i] }))
        this.controls.push({ label: 'HOLD WORK · E', hold: 'KeyE' }, { label: 'SKATE · SHIFT', key: 'ShiftLeft' })
        this.arena = run.assets.arena(run, 'ship_it', name => name !== 'mg_app_phone')
        this.orbs = run.assets.instances(run, 'mg_task_orb', 5, null, true)
        this.phones = ['app_focusfi', 'app_lucid'].map(card => run.assets.instances(run, 'mg_app_phone', 1, card))
        // Baked city view, outside the playable deck; no extra city geometry.
        const backdropGeometry = new THREE.PlaneGeometry(42, 16)
        const uv = backdropGeometry.attributes.uv
        for(let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
        const backdrop = new THREE.Mesh(backdropGeometry, run.assets.material('nd_window', run))
        backdrop.rotation.x = Math.PI / 2
        backdrop.position.set(0, 13, 8)
        run.root.add(backdrop); run.geometries.push(backdropGeometry)
        this.apps = ['FocusFi', 'Lucid'].map((name, i) => ({ name, phase: 'feature', builds: new Set(), rejections: 0, p: [-2 + i * 4, 0, 1], shippedAt: 0 }))
        this.stations = this.arena.place.mg_station.map((p, i) => ({ p, name: this.arena.stations[i] }))
        this.stations.push({ p: [8, -3.5, 0], name: 'REVIEW' })
        this.carry = null; this.progress = 0; this.payments = 0; this.storm = 0; this.dropped = 0; this.lastEvent = 0
        const e = run.world.explorer
        if(!e.active)
        {
            e.active = true; run.world.physics.onFoot = true
            run.world.physics.world.addBody(e.body)
            e.parked = { position: run.saved.car.clone(), quaternion: run.saved.quaternion.clone() }
        }
        e.body.position.set(540, 320, 0.38)
        e.avatar.visible = true
    }
    action(key) { if(key.startsWith('Shift')) this.run.world.explorer.setSkating(!this.run.world.explorer.skating) }
    update(dt)
    {
        const r = this.run, e = r.world.explorer, b = e.body
        const speed = e.skating ? 7.6 : 3.2
        let x = r.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']), y = r.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'])
        const length = Math.hypot(x, y)
        if(length > 1) { x /= length; y /= length }
        b.velocity.x = x * speed; b.velocity.y = y * speed
        b.position.x = Math.max(530.5, Math.min(549.5, b.position.x)); b.position.y = Math.max(313.5, Math.min(326.5, b.position.y))
        b.position.z = 0.38; b.velocity.z = 0
        const p = [b.position.x - 540, b.position.y - 320]
        if(this.carry === null)
        {
            const index = this.apps.findIndex(app => app.phase !== 'shipped' && Math.hypot(p[0] - app.p[0], p[1] - app.p[1]) < 1.4)
            if(index >= 0) { this.carry = index; r.cue() }
        }
        const near = this.stations.find(station => Math.hypot(p[0] - station.p[0], p[1] - station.p[1]) < 1.8)
        const app = this.apps[this.carry]
        const working = near && r.held('KeyE') && (near.name === 'PAYMENTS' || app && (near.name === 'CODE' && ['feature', 'fix'].includes(app.phase) || near.name.startsWith('BUILD') && app.phase === 'build' && !app.builds.has(near.name) || near.name === 'REVIEW' && app.phase === 'review'))
        this.progress = working ? this.progress + dt : 0
        if(this.progress >= (near?.name === 'CODE' ? 3 : 1.5))
        {
            this.progress = 0
            if(near.name === 'PAYMENTS') { this.payments = 0; this.storm = 0 }
            else
            {
                // Rejection is deterministic and fixable, not a random unavoidable loss.
                const reject = near.name === 'REVIEW' && this.payments > 0
                shipStep(app, near.name, reject)
                if(app.phase === 'shipped') { app.shippedAt = r.elapsed; this.carry = null }
                if(reject) { this.payments = Math.max(0, this.payments - 1); r.cue(false) }
                else r.cue()
            }
        }
        if(Math.floor(r.elapsed / 25) > this.lastEvent)
        {
            this.lastEvent = Math.floor(r.elapsed / 25)
            this.payments += 3; this.storm += 3
        }
        let n = 0
        this.apps.forEach((a, i) =>
        {
            if(a.phase === 'shipped') return
            this.orbs.tint(n, { feature: '#22e5ff', build: '#8caeff', review: '#ff55d9', fix: '#ff6262' }[a.phase])
            this.orbs.set(n++, i === this.carry ? [p[0], p[1], 1.8] : a.p)
        })
        for(let i = 0; i < Math.min(3, this.payments); i++) { this.orbs.tint(n, '#ffb02e'); this.orbs.set(n++, [5 + i, 0.5, 1], 0.7) }
        this.orbs.commit(n)
        const current = app ? `${app.name}: ${app.phase.toUpperCase()}${app.phase === 'build' ? ` (${[...app.builds].join(' + ') || 'both platforms'})` : ''}` : 'Pick up an app orb in the centre'
        const candidates = !app ? [] : ['feature', 'fix'].includes(app.phase) ? ['CODE'] : app.phase === 'build' ? ['BUILD iOS', 'BUILD ANDROID'].filter(name => !app.builds.has(name)) : this.payments ? ['PAYMENTS'] : ['REVIEW']
        const next = this.stations.filter(s => candidates.includes(s.name)).sort((a, b) => Math.hypot(p[0] - a.p[0], p[1] - a.p[1]) - Math.hypot(p[0] - b.p[0], p[1] - b.p[1]))[0]
        const guidance = next ? `NEXT → ${next.name} · ${Math.ceil(Math.hypot(p[0] - next.p[0], p[1] - next.p[1]))}m` : 'COLLECT → an app orb in the centre'
        const work = working ? `${near.name}: WORKING ${Math.round(this.progress / (near.name === 'CODE' ? 3 : 1.5) * 100)}%` : near && candidates.includes(near.name) ? `${near.name}: hold E / WORK` : near ? `${near.name} · ${guidance}` : guidance
        r.hud(`${this.apps.filter(a => a.phase === 'shipped').length}/2 shipped · ${Math.ceil(120 - r.elapsed)}s · ${this.payments} webhooks`, `${current} · ${work}${app?.phase === 'fix' ? ' · Fix the rejection at CODE, then rebuild both platforms' : ''}`)
        if(this.apps.every(a => a.phase === 'shipped'))
        {
            const rejects = this.apps.reduce((s, a) => s + a.rejections, 0)
            r.finish(true, `FocusFi and Lucid shipped in ${Math.ceil(r.elapsed)}s. ${rejects} rejections. Infra cost ${this.payments === 0 ? '−80%' : 'still backed up'}.`, r.elapsed < 90 && !this.payments && !rejects ? 'gold' : rejects <= 1 ? 'silver' : 'bronze')
        }
        else if(r.elapsed >= 120) r.finish(false, 'Time ran out. Code, both platforms, payments, review: there is nobody else to hand the build to.', null)
    }
    camera()
    {
        const p = this.run.world.explorer.body.position
        this.run.cameraPosition.set(p.x, p.y - 11, 11)
        this.run.cameraLook.set(p.x, p.y + 2, 0.5)
    }
    frame()
    {
        this.phones.forEach((phone, i) =>
        {
            const app = this.apps[i], p = this.arena.place.mg_app_phone[i]
            const lift = app.phase === 'shipped' ? this.run.world.config.reducedMotion ? 3 : Math.min(3, (this.run.world.time.elapsed - (app.shippedVisualAt ||= this.run.world.time.elapsed)) / 1000) : 0
            phone.set(0, [p[0], p[1], p[2] + lift]); phone.commit(1)
        })
    }
}
