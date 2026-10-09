import * as THREE from 'three'
import { Howler } from 'howler'
import { beatJudgement, medalByCount } from './rules.js'

export default class BeatTunnel
{
    constructor(run)
    {
        this.run = run; this.title = 'Beat Tunnel'
        this.instructions = '100 BPM flight. W/S up/down, A/D left/right (or drag). Steer through each offset ring. SPACE / BOOST at a drop gate. Hit 70% to pass.'
        this.controls = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].map((hold, i) => ({ hold, label: ['UP ↑', 'LEFT ←', 'DOWN ↓', 'RIGHT →'][i] }))
        this.controls.push({ label: 'BOOST · SPACE', key: 'Space' })
        this.spec = run.world.resources.items.cyberMiniGameSpec.beatTunnel
        this.period = 60 / this.spec.bpm
        this.curve = new THREE.CatmullRomCurve3(this.spec.path.map(p => new THREE.Vector3(...p)))
        this.length = this.curve.getLength()
        this.rings = run.assets.instances(run, 'mg_beat_ring', this.spec.rings.length)
        this.gates = run.assets.instances(run, 'mg_beat_gate', 3)
        this.pattern = [[0, 0], [-1.8, 0], [1.8, 0], [0, 1.8], [0, -1.8], [-1.4, 1.4], [1.4, -1.4], [0, 0]]
        this.offset = new THREE.Vector2(); this.dragOffset = new THREE.Vector2()
        this.hits = 0; this.perfect = 0; this.index = 0; this.combo = 0; this.score = 0; this.gatesHit = 0; this.boostAt = -10
        this.position = new THREE.Vector3(); this.forward = new THREE.Vector3(); this.right = new THREE.Vector3()
        this.audioNodes = []
        this.frame()
    }
    drag(x, y) { this.dragOffset.set(THREE.MathUtils.clamp(x / 50, -2.4, 2.4), THREE.MathUtils.clamp(-y / 50, -2.4, 2.4)) }
    action(key) { if(key === 'Space') this.boostAt = this.run.elapsed }
    drone()
    {
        if(this.audioNodes.length || !Howler.ctx) return
        const ctx = Howler.ctx
        this.audioGain = ctx.createGain(); this.audioGain.gain.value = 0.035; this.audioGain.connect(Howler.masterGain)
        for(const [freq, pan] of [[200, -1], [208, 1]])
        {
            const oscillator = ctx.createOscillator(), panner = ctx.createStereoPanner()
            oscillator.frequency.value = freq; panner.pan.value = pan
            oscillator.connect(panner); panner.connect(this.audioGain); oscillator.start()
            this.audioNodes.push(oscillator, panner)
        }
    }
    kick()
    {
        if(!Howler.ctx) return
        const ctx = Howler.ctx, osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.frequency.setValueAtTime(120, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.12)
        gain.gain.setValueAtTime(0.14, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15)
        osc.connect(gain); gain.connect(Howler.masterGain); osc.start(); osc.stop(ctx.currentTime + 0.16)
        osc.onended = () => { osc.disconnect(); gain.disconnect() }
    }
    update(dt)
    {
        const r = this.run
        this.drone()
        this.audioGain?.gain.setTargetAtTime(r.world.sounds.muted ? 0 : 0.035, Howler.ctx.currentTime, 0.04)
        const target = new THREE.Vector2(r.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft']) * 2.4, r.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']) * 2.4).add(this.dragOffset)
        this.offset.lerp(target, 1 - Math.exp(-dt * 12))
        const beat = Math.floor(r.elapsed / this.period)
        if(beat !== this.lastBeat) { this.kick(); this.lastBeat = beat }
        // Each authored centre is one beat ahead of the start point. Interpolate
        // the checked ring polyline, rather than cutting corners through towers.
        const progress = r.elapsed / this.period
        while(this.index < this.spec.rings.length && progress >= this.index + 1)
        {
            const ring = this.spec.rings[this.index], offset = this.pattern[this.index % this.pattern.length]
            const judgement = beatJudgement(this.offset.distanceTo(new THREE.Vector2(...offset)), r.elapsed - (this.index + 1) * this.period, Math.abs(r.elapsed - this.boostAt) < 0.18, ring.kind === 'gate')
            if(judgement !== 'MISS') { this.hits++; this.combo++; this.score += (judgement === 'PERFECT' ? 100 : 60) * Math.min(4, 1 + Math.floor(this.combo / 8)); if(ring.kind === 'gate') this.gatesHit++; r.cue() }
            else this.combo = 0
            if(judgement === 'PERFECT') this.perfect++
            this.index++
            r.hud(`${this.hits}/${this.spec.rings.length} hits · combo ${this.combo} · ${this.score} pts`, `${judgement} · Next: ${this.spec.rings[this.index]?.kind === 'gate' ? 'DROP GATE — BOOST' : 'steer to the ring centre'}`)
        }
        this.frame()
        if(this.index === this.spec.rings.length)
        {
            const rate = this.hits / this.index
            const medal = medalByCount(rate, 0.7, 0.85, this.gatesHit === 3 ? 0.95 : Infinity)
            r.finish(!!medal, `${this.hits}/${this.index} rings (${Math.round(rate * 100)}%). ${this.perfect} perfect, ${this.gatesHit}/3 drop gates. Taste is a leading indicator.`, medal)
        }
    }
    frame()
    {
        const r = this.run, progress = Math.min(this.spec.rings.length, r.elapsed / this.period), index = Math.floor(progress)
        const start = index === 0 ? new THREE.Vector3(...this.spec.path[0]) : new THREE.Vector3(...this.spec.rings[Math.min(index - 1, this.spec.rings.length - 1)].p)
        const end = new THREE.Vector3(...this.spec.rings[Math.min(index, this.spec.rings.length - 1)].p)
        this.forward.copy(end).sub(start).normalize()
        if(this.forward.lengthSq() < 0.1) this.forward.set(-1, 0, 0)
        this.right.set(this.forward.y, -this.forward.x, 0).normalize()
        this.position.copy(start).lerp(end, progress % 1).addScaledVector(this.right, this.offset.x)
        this.position.z += this.offset.y
        const car = r.world.physics.car.chassis.body
        car.position.set(this.position.x, this.position.y, this.position.z); car.velocity.set(0, 0, 0)
        const yaw = Math.atan2(this.forward.y, this.forward.x)
        car.quaternion.setFromAxisAngle({ x: 0, y: 0, z: 1 }, yaw)
        r.world.hoverFlight.yaw = yaw
        let rings = 0, gates = 0
        for(let i = this.index; i < Math.min(this.index + 12, this.spec.rings.length); i++)
        {
            const ring = this.spec.rings[i], forward = new THREE.Vector3(...ring.forward)
            const right = new THREE.Vector3(forward.y, -forward.x, 0).normalize(), p = new THREE.Vector3(...ring.p)
            p.addScaledVector(right, this.pattern[i % 8][0]); p.z += this.pattern[i % 8][1]
            const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), forward)
            const scale = r.world.config.reducedMotion ? 1 : 1 + Math.exp(-((r.elapsed / this.period) % 1) * 8) * 0.06
            if(ring.kind === 'gate') this.gates.set(gates++, p.toArray(), scale, rotation)
            else this.rings.set(rings++, p.toArray(), scale, rotation)
        }
        this.rings.commit(rings); this.gates.commit(gates)
    }
    camera()
    {
        this.run.cameraPosition.copy(this.position).addScaledVector(this.forward, -9); this.run.cameraPosition.z += 3.2
        this.run.cameraLook.copy(this.position).addScaledVector(this.forward, 8)
    }
    stop()
    {
        this.audioNodes.forEach(node => { if(node.stop) node.stop(); node.disconnect() }); this.audioNodes = []
        this.audioGain?.disconnect(); this.audioGain = null
    }
}
