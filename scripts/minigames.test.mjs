import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { handoffThreshold, needsHandoff, containmentChoice, sentimentMedal, beatJudgement, packetLoad, coolPackets, shipStep } from '../src/javascript/World/MiniGames/rules.js'
import { CONTAINMENT_CASES } from '../src/javascript/World/careerData.js'
import Containment from '../src/javascript/World/MiniGames/Containment.js'
import SignalNoise from '../src/javascript/World/MiniGames/SignalNoise.js'
import Handoff from '../src/javascript/World/MiniGames/Handoff.js'
import PacketRun from '../src/javascript/World/MiniGames/PacketRun.js'
import { intersectsFlightPath, packetRoute } from '../src/javascript/World/MiniGames/packetNavigation.js'

const cards = JSON.parse(fs.readFileSync(new URL('../static/models/cyber/minigame-atlas.json', import.meta.url))).rects
const run = () => ({ elapsed: 0, world: { config: { reducedMotion: false } }, hud() {}, cue() {},
    assets: { cards, arena() {}, instances: () => ({ set() {}, commit() {}, card() {} }) },
    finish(passed, summary, medal) { this.result = { passed, summary, medal } } })

const packetRun = () => {
    const r = run()
    const vector = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }) } })
    r.world.resources = { items: { cyberMiniGameSpec: JSON.parse(fs.readFileSync('static/models/cyber/minigames.json')) } }
    r.world.physics = { car: { chassis: { body: { position: vector(), velocity: vector(), quaternion: { setFromAxisAngle() {} } } } } }
    r.world.hoverFlight = { yaw: 0 }
    r.assets.fixed = () => {}
    r.axis = () => 0; r.held = () => false
    const game = new PacketRun(r)
    return { r, game, body: r.world.physics.car.chassis.body }
}

test('Packet Run routes a partial load to a drop-off when the other packets expire', () => {
    const { game, body } = packetRun()
    game.spawnTimer = 100
    game.live = [{ p: [-36, -30, 42], ttl: 12 }, { p: [0, 0, 42], ttl: 0.01 }]
    game.update(0.02)
    assert.equal(game.carry, 1)
    assert.equal(game.live.length, 0)
    game.pointTarget()
    assert.ok(game.spec.racks.some(rack => rack.intakeRing === game.target), 'carrying cargo must point at a delivery ring, not an empty facility')
    body.position.set(...game.target)
    game.update(0)
    assert.equal(game.state.served, 1)
    assert.equal(game.carry, 0)
})

test('Packet Run tells the player to deliver immediately after collecting a batch', () => {
    const { r, game } = packetRun()
    let detail = ''
    r.hud = (_, text) => { detail = text }
    game.spawnTimer = 100
    game.live = Array.from({ length: 3 }, () => ({ p: [-36, -30, 42], ttl: 12 }))
    game.update(0)
    assert.match(detail, /DELIVER|DROP OFF/)
    assert.ok(game.spec.racks.some(rack => rack.intakeRing === game.target))
})

test('Packet route climbs over the real building that blocked the old delivery path', () => {
    const layout = JSON.parse(fs.readFileSync('static/models/cyber/district-layout.json'))
    const boxes = layout.towers.map(({ collision: { center, size } }) => ({
        min: { x: center[0] - size[0] / 2, y: center[1] - size[1] / 2, z: center[2] - size[2] / 2 },
        max: { x: center[0] + size[0] / 2, y: center[1] + size[1] / 2, z: center[2] + size[2] / 2 }
    }))
    const start = { x: -10, y: -43.35, z: 42 }, end = [69, -52, 69]
    assert.ok(boxes.some(box => intersectsFlightPath([start.x, start.y, start.z], end, box)))
    const route = packetRoute(start, end, boxes)
    assert.equal(route.at(-1), end)
    assert.ok(route[0][2] > 70, 'the old course ceiling made the obstructing roof impossible to clear')
    let previous = [start.x, start.y, start.z]
    for(const point of route) {
        assert.ok(boxes.every(box => !intersectsFlightPath(previous, point, box)), `route segment blocked: ${previous} → ${point}`)
        previous = point
    }
})

test('Packet queues wait for the player and pickups fill the rack before delivery guidance', () => {
    const { game, body } = packetRun()
    game.update(1)
    assert.equal(game.live.length, 0, 'remote queues must not expire during the commute')
    game.live = [{ p: [-36, -30, 42], ttl: 12 }, { p: [-30, -30, 42], ttl: 12 }]
    game.update(0)
    assert.equal(game.carry, 1)
    assert.equal(game.destinationType, 'pickup')
    body.position.set(-30, -30, 42); game.update(0)
    assert.equal(game.carry, 2)
    assert.equal(game.destinationType, 'drop', 'partial load can still deliver after the queue is empty')
})

test('handoff exact thresholds and eval mismatch', () => {
    for(const stakes of ['HIGH', 'MED', 'LOW']) {
        const confidence = handoffThreshold(stakes)
        assert.equal(needsHandoff({ stakes, confidence }), false)
        assert.equal(needsHandoff({ stakes, confidence: confidence - 1 }), true)
        assert.equal(needsHandoff({ stakes, confidence: 100, mismatch: true }), true)
    }
})
test('sentiment accuracy medals include sarcasm requirement', () => {
    assert.equal(sentimentMedal(43, 50), null)
    assert.equal(sentimentMedal(44, 50), 'bronze')
    assert.equal(sentimentMedal(46, 50), 'silver')
    assert.equal(sentimentMedal(48, 50), 'gold')
    assert.equal(sentimentMedal(48, 50, 1), 'silver')
    assert.equal(sentimentMedal(0, 0), null)
})
test('beat timing, spatial window and gates', () => {
    assert.equal(beatJudgement(0.6, 0.06, false), 'PERFECT')
    assert.equal(beatJudgement(0.61, 0, false), 'GOOD')
    assert.equal(beatJudgement(0.1, 0.061, false), 'GOOD')
    assert.equal(beatJudgement(2.41, 0, true), 'MISS')
    assert.equal(beatJudgement(0, 0, false, true), 'MISS')
    assert.equal(beatJudgement(0, 0, true, true), 'PERFECT')
})
test('packet cooling and sustained p95 overload', () => {
    const state = { loads: [0, 0, 0], p95: 0, redTime: 0, served: 0 }
    packetLoad(state, 0, 3)
    assert.equal(state.served, 3); assert.equal(state.loads[0], 0.36)
    coolPackets(state, 1); assert.equal(state.loads[0], 0.3)
    state.loads[0] = 0.9
    packetLoad(state, 0, 8)
    assert.equal(state.p95, 1)
    for(let i = 0; i < 29; i++) { state.p95 = 1; assert.equal(coolPackets(state, 0.1), false) }
    state.p95 = 1; assert.equal(coolPackets(state, 0.11), true)
})
test('ship state requires both builds and handles rejected release', () => {
    const app = { phase: 'feature', builds: new Set(), rejections: 0 }
    assert.equal(shipStep(app, 'REVIEW'), 'feature')
    assert.equal(shipStep(app, 'CODE'), 'build')
    assert.equal(shipStep(app, 'BUILD iOS'), 'build')
    assert.equal(shipStep(app, 'BUILD iOS'), 'build')
    assert.equal(shipStep(app, 'BUILD ANDROID'), 'review')
    assert.equal(shipStep(app, 'REVIEW', true), 'fix')
    assert.equal(app.rejections, 1); assert.equal(app.builds.size, 0)
    shipStep(app, 'CODE'); shipStep(app, 'BUILD iOS'); shipStep(app, 'BUILD ANDROID')
    assert.equal(shipStep(app, 'REVIEW'), 'shipped')
})
test('containment keeps all case contents; approval is held, not auto-executed', () => {
    for(const item of CONTAINMENT_CASES) assert.equal(containmentChoice(item), item.verdict === 'auto' ? 'allow' : 'deny')
    const r = run(), game = new Containment(r)
    for(let i = 0; i < 30; i++) game.action(containmentChoice(game.item) === 'allow' ? 'KeyA' : 'KeyD')
    assert.equal(r.result.passed, true); assert.equal(game.count, 30)
    const failed = run(), breach = new Containment(failed)
    breach.action(containmentChoice(breach.item) === 'allow' ? 'KeyD' : 'KeyA')
    assert.equal(failed.result.passed, false)
})
test('Signal / Noise completes 50 actual atlas cards; expired cards count as wrong', () => {
    const r = run(), game = new SignalNoise(r)
    const key = { positive: 'KeyA', neutral: 'KeyS', negative: 'KeyD' }
    for(let i = 0; i < 50; i++) game.action(key[game.post.truth])
    assert.equal(r.result.passed, true); assert.equal(r.result.medal, 'gold')
    const missed = run(), loss = new SignalNoise(missed)
    for(let i = 0; i < 50; i++) loss.update(loss.window + 0.01)
    assert.equal(missed.result.passed, false)
})
test('Handoff correct routing earns throughput; 3 unsafe high-stakes calls fail', () => {
    const r = run(), game = new Handoff(r)
    for(let i = 0; i < 50; i++) game.action(needsHandoff(game.item) ? 'ArrowLeft' : 'ArrowRight')
    game.end(); assert.equal(r.result.passed, true)
    const failed = run(), loss = new Handoff(failed)
    for(let i = 0; i < 3; i++) { loss.item = { stakes: 'HIGH', confidence: 50 }; loss.action('ArrowRight') }
    assert.equal(failed.result.passed, false)
})
