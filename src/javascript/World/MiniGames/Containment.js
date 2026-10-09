import { CONTAINMENT_CASES } from '../careerData.js'
import { containmentChoice } from './rules.js'

export default class Containment
{
    constructor(run)
    {
        this.run = run
        this.title = 'Containment'
        this.instructions = 'A / ← = ALLOW. D / → = DENY (including approval-required calls). One wrong ruling breaches the manifest. Clear 30 calls.'
        this.controls = [{ label: 'ALLOW · A', key: 'KeyA' }, { label: 'DENY / HOLD · D', key: 'KeyD' }]
        this.arena = run.assets.arena(run, 'triage', name => !/junction|filing_chute|human_desk/.test(name))
        this.pod = run.assets.instances(run, 'mg_toolcall_pod', 1, 'tool_read_file')
        this.count = 0; this.timer = 0
        this.next()
    }
    next()
    {
        this.item = CONTAINMENT_CASES[(this.count * 7) % CONTAINMENT_CASES.length]
        this.window = (this.run.world.config.reducedMotion ? 8 : 6) - Math.min(3, Math.floor(this.count / 5) * 0.4)
        this.timer = 0
        this.run.hud(`100% contained · ${this.count}/30 calls`, `${this.item.call}   |   ${this.item.manifest}`)
    }
    action(key)
    {
        const choice = ['KeyA', 'ArrowLeft'].includes(key) ? 'allow' : ['KeyD', 'ArrowRight'].includes(key) ? 'deny' : null
        if(!choice) return
        if(choice !== containmentChoice(this.item)) { this.run.cue(false); this.run.finish(false, `BREACH after ${this.count} calls. ${this.item.note}`, null); return }
        this.count++; this.run.cue()
        if(this.count === 30) this.run.finish(true, '30/30 calls contained. The model was never the authority.', 'gold')
        else this.next()
    }
    update(dt)
    {
        this.timer += dt
        this.pod.set(0, [0, 6 - Math.min(1, this.timer / this.window) * 12, 1]); this.pod.commit(1)
        if(this.timer > this.window) this.run.finish(false, `Timed out after ${this.count} calls. A manifest must be checked before execution.`, null)
    }
    camera()
    {
        this.run.cameraPosition.set(480, 312.5, 3.2)
        this.run.cameraLook.set(480, 321, 1.5)
    }
}
