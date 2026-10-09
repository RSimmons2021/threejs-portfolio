import test from 'node:test'
import assert from 'node:assert/strict'
import { cityGuideRoute, guideBearing, roundedGuidePath, sampleGuidePath, projectGuidePath, flightGuidePath, guideArrived, smoothGuideRotation } from '../src/javascript/World/cityGuideRules.js'

test('project routes stay on the avenue until the selected case-study column', () =>
{
    for(let index = 0; index < 6; index++)
    {
        const destination = { group: 'projects', x: 25.2 + index * 24, y: -35 }
        assert.deepEqual(cityGuideRoute({ x: 0, y: -30 }, destination), [[0,-30], [destination.x,-30], [destination.x,-35]])
    }
})

test('guide rotation takes the short arc across the wrap and is frame-rate independent', () =>
{
    assert.equal(smoothGuideRotation(null, 90, 1 / 60), 90)
    const next = smoothGuideRotation(179, -179, 1 / 60)
    assert.ok(next > 179 && next < 181)
    let sixty = 0, thirty = 0
    for(let i = 0; i < 60; i++) sixty = smoothGuideRotation(sixty, 90, 1 / 60)
    for(let i = 0; i < 30; i++) thirty = smoothGuideRotation(thirty, 90, 1 / 30)
    assert.ok(Math.abs(sixty - thirty) < 1e-9)
    assert.equal(smoothGuideRotation(179, -179, 1 / 60, true), 181)
})

test('rounded street route is anchored, bounded and contained at junctions', () =>
{
    const path = roundedGuidePath([[0, -30], [140, -30], [140, -35]])
    assert.ok(path.length <= 64)
    assert.ok(path.every(p => p.x >= 0 && p.x <= 140 && p.y <= -30 && p.y >= -35 && p.z === .09))
    assert.ok(path.slice(1).every((p, i) => p.s > path[i].s))
    const snapshot = JSON.stringify(path), record = {}
    assert.equal(sampleGuidePath(path, 14, record), record, 'samples reuse the caller record')
    assert.equal(record.x, 14)
    assert.equal(projectGuidePath(path, { x: 8, y: -29, z: .5 }), 8)
    sampleGuidePath(path, 21, record)
    assert.equal(JSON.stringify(path), snapshot, 'player sampling cannot move the street route')
    const singleton = roundedGuidePath([[16,-56.5],[16,-56.5]])
    assert.equal(singleton.length, 1)
    assert.ok(Object.values(sampleGuidePath(singleton, 0)).every(Number.isFinite))
})

test('flight approach turns down only inside the destination column and waits for touchdown', () =>
{
    const destination = { x: 40, y: -35 }, pool = []
    const path = flightGuidePath({ x: 0, y: -35, z: 40 }, destination, pool)
    const first = path[0]
    assert.equal(sampleGuidePath(path, 10).z, 39.25)
    assert.ok(path.filter(p => p.z < 39.25).every(p => Math.hypot(p.x - 40, p.y + 35) <= 5))
    assert.deepEqual(path[path.length - 1], { x: 40, y: -35, z: .09, s: path[path.length - 1].s })
    assert.equal(flightGuidePath({ x: 40, y: -35, z: 20 }, destination, pool), pool)
    assert.equal(pool[0], first, 'flight rebuilds reuse point records')
    assert.equal(sampleGuidePath(pool, 7).pitch, -Math.PI / 2)
    assert.equal(guideArrived({ x: 40, y: -35, z: 20 }, destination), false)
    assert.equal(guideArrived({ x: 40, y: -35, z: .5 }, destination), true)
})
test('contact and arcade use distinct approaches and bearings wrap safely', () =>
{
    assert.deepEqual(cityGuideRoute({ x: 30, y: -30 }, { group: 'about', x: 16, y: -56.5 }), [[30,-30],[0,-30],[0,-56.5],[16,-56.5]])
    assert.deepEqual(cityGuideRoute({ x: 0, y: -30 }, { group: 'play', x: -22, y: -43 }), [[0,-30],[-22,-30],[-22,-43]])
    assert.equal(guideBearing({ x: 0, y: 0 }, [0, 10], Math.PI / 2).direction, 'Ahead')
    assert.equal(guideBearing({ x: 0, y: 0 }, [0, 10], 0).direction, 'Left')
    assert.equal(guideBearing({ x: 0, y: 0 }, [10, 0], Math.PI / 2).direction, 'Right')
    assert.equal(guideBearing({ x: 0, y: 0 }, [10, 0], Math.PI * 2).direction, 'Ahead')
    assert.deepEqual(cityGuideRoute({ x: 16, y: -56.5 }, { group: 'about', x: 16, y: -56.5 }), [[16,-56.5],[16,-56.5]])
})
