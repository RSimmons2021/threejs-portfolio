import test from 'node:test'
import assert from 'node:assert/strict'
import { SPRINT_GATES, crossedGate, medalFor, readBest, writeBest } from '../src/javascript/World/arcadeRules.js'

test('sprint gates require a swept crossing in order and in the correct lane/direction', () => {
    assert.equal(SPRINT_GATES.length, 8)
    const gate = SPRINT_GATES[0]
    assert.ok(crossedGate({ x: 4, y: -29 }, { x: 6, y: -29, z: .35 }, gate))
    assert.ok(!crossedGate({ x: 6, y: -29 }, { x: 4, y: -29, z: .35 }, gate))
    assert.ok(!crossedGate({ x: 4, y: -35 }, { x: 6, y: -35, z: .35 }, gate))
    assert.ok(!crossedGate({ x: -20, y: -29 }, { x: 6, y: -29, z: .35 }, gate))
    assert.ok(!crossedGate({ x: 4, y: -29 }, { x: 6, y: -29, z: 3 }, gate))
    const returning = SPRINT_GATES[4]
    assert.ok(crossedGate({ x: 138, y: -35 }, { x: 136, y: -35, z: .35 }, returning))
})

test('medals reward lower race times and higher pin totals', () => {
    assert.equal(medalFor('sprint', 32), 'GOLD')
    assert.equal(medalFor('sprint', 40), 'SILVER')
    assert.equal(medalFor('sprint', 50), 'BRONZE')
    assert.equal(medalFor('bowling', 25), 'GOLD')
    assert.equal(medalFor('bowling', 18), 'SILVER')
    assert.equal(medalFor('bowling', 10), 'BRONZE')
    assert.equal(medalFor('bowling', 0), 'KEEP ROLLING')
})

test('local bests are bounded and unavailable storage never breaks play', () => {
    assert.deepEqual(readBest(null), { sprint: null, bowling: 0, ghost: [] })
    assert.equal(writeBest(null, {}), false)
    const invalid = { getItem: () => '{not json' }
    assert.equal(readBest(invalid).sprint, null)
    const storage = { value: '', getItem() { return this.value }, setItem(key, value) { this.value = value } }
    const best = { sprint: 30, bowling: 25, ghost: [[0, -20, -29, .35, 0], [1, -10, -29, .35, 0]] }
    assert.ok(writeBest(storage, best))
    assert.deepEqual(readBest(storage), best)
    storage.value = JSON.stringify({ sprint: -1, bowling: 999, ghost: [[0, 0, 0, 0, 0]] })
    assert.deepEqual(readBest(storage), { sprint: null, bowling: 0, ghost: [] })
})
