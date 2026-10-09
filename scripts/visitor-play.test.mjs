import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FLIGHT_CEILING, SOFT_CEILING, ceilingVelocity } from '../src/javascript/World/flightRules.js'
import { ENTRY_HEIGHT } from '../src/javascript/World/areaRules.js'
import { STARTER_CREDITS, withStarterCredits } from '../src/javascript/World/careerRules.js'

test('free flight clears the tallest district roof and slows safely at 160m', () =>
{
    const layout = JSON.parse(readFileSync('static/models/cyber/district-layout.json'))
    assert.ok(FLIGHT_CEILING > Math.max(...layout.towers.map(t => t.height)) + 30)
    assert.equal(FLIGHT_CEILING, 160)
    assert.equal(ceilingVelocity(100, 8), 8)
    assert.ok(ceilingVelocity(SOFT_CEILING + 5, 8) > 0)
    assert.equal(ceilingVelocity(FLIGHT_CEILING, 8), 0)
    assert.ok(ceilingVelocity(FLIGHT_CEILING + 1, 8) < 0)
    assert.equal(ceilingVelocity(159, -10), -10)
    assert.equal(ceilingVelocity(155, 0), 0, 'hover below the ceiling does not forcibly descend')
    assert.ok(ENTRY_HEIGHT >= FLIGHT_CEILING)
})

test('starter grant upgrades old saves once and preserves earned progress', () =>
{
    const save = { credits: 85, day: 4, stats: { ai: 6 }, owned: ['headphones'], quests: ['sleep'] }
    const upgraded = withStarterCredits(save)
    assert.equal(upgraded.credits, 85 + STARTER_CREDITS)
    assert.equal(upgraded.day, 4)
    assert.deepEqual(upgraded.stats, save.stats)
    assert.deepEqual(upgraded.owned, save.owned)
    assert.deepEqual(upgraded.quests, save.quests)
    assert.equal(withStarterCredits(upgraded), upgraded)
    assert.equal(save.credits, 85, 'migration does not mutate its input')
    assert.equal(withStarterCredits({ credits: 0 }).credits, 300)
    assert.equal(withStarterCredits({ credits: NaN }).credits, 300)
})

test('cockpit eye uses the mesh frame, not the lower physics-body frame', () =>
{
    const spec = JSON.parse(readFileSync('static/models/cyber/hover-car.json'))
    const eye = spec.cockpit.eye
    assert.ok(eye.meshFrame[2] >= 0.9)
    assert.ok(eye.meshFrame[2] > eye.bodyFrameZ + 0.25)
    const source = readFileSync('src/javascript/World/Explorer.js', 'utf8')
    assert.match(source, /cockpitEye\.fromArray\(this\.world\.resources\.items\.hoverCarSpec\.cockpit\.eye\.meshFrame\)/)
})
