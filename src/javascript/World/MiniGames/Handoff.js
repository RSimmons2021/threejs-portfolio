import { needsHandoff, medalByCount } from './rules.js'

export default class Handoff
{
    constructor(run)
    {
        this.run = run; this.title = 'Handoff'
        this.instructions = '← ESCALATE / → AUTO. HIGH needs 92%, MED 80%, LOW 60%. Always escalate an eval mismatch. Reach 500 documents in 90s; 3 harm strikes end the shift.'
        this.controls = [{ label: '← ESCALATE', key: 'ArrowLeft' }, { label: 'AUTO-FILE →', key: 'ArrowRight' }]
        run.assets.arena(run, 'triage', name => !/lever/.test(name))
        this.docs = run.assets.cards.filter(c => c.kind === 'doc')
        this.folder = run.assets.instances(run, 'mg_doc_folder', 1, this.docs[0].id)
        this.count = 0; this.throughput = 0; this.strikes = 0; this.queue = 0; this.timer = 0
        this.next()
    }
    next()
    {
        const doc = this.docs[(this.count * 5) % this.docs.length]
        this.item = { stakes: doc.stakes, confidence: 50 + (this.count * 17 + 39) % 50, mismatch: this.count % 11 === 8 }
        this.folder.card(doc.id)
        this.timer = 0
        this.window = this.queue > 4 ? 2.4 : 1.6
        this.detail = `${doc.id.replace('doc_', '').replaceAll('_', ' ')} · ${this.item.stakes} stakes · confidence ${this.item.confidence}%${this.item.mismatch ? ' · EVAL MISMATCH: escalate' : ''} · AUTO needs HIGH 92% / MED 80% / LOW 60%`
        this.hud()
    }
    action(key)
    {
        const escalate = ['ArrowLeft', 'KeyA'].includes(key), auto = ['ArrowRight', 'KeyD'].includes(key)
        if(!escalate && !auto) return
        const required = needsHandoff(this.item), good = escalate === required
        if(good) this.throughput++
        if(escalate) this.queue += 1
        if(auto && required && this.item.stakes === 'HIGH') this.strikes++
        this.count++; this.run.cue(good)
        if(this.strikes >= 3) this.end()
        else this.next()
    }
    end()
    {
        const medal = this.strikes <= 2 ? medalByCount(this.throughput * 10, 500, this.strikes <= 1 ? 650 : Infinity, this.strikes === 0 ? 800 : Infinity) : null
        this.run.finish(!!medal, `${this.throughput * 10} documents validated. ${this.strikes} client-harm strikes. Escalation criteria are part of the product.`, medal)
    }
    update(dt)
    {
        this.timer += dt; this.queue = Math.max(0, this.queue - dt * 0.6)
        const progress = Math.min(1, this.timer / this.window)
        this.folder.set(0, [0, 6 - progress * 12, 1]); this.folder.commit(1)
        this.hud()
        if(this.timer > this.window) { this.count++; this.next() }
        if(this.run.elapsed >= 90) this.end()
    }
    hud()
    {
        this.run.hud(`${this.throughput * 10}/500 docs · ${this.strikes}/3 harm · queue ${Math.ceil(this.queue)} · ${Math.ceil(90 - this.run.elapsed)}s · decide in ${Math.max(0, this.window - this.timer).toFixed(1)}s`, this.detail)
    }
    camera() { this.run.cameraPosition.set(483.8, 311, 5); this.run.cameraLook.set(480, 320, 1.2) }
}
