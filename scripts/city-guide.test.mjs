import test from 'node:test'
import assert from 'node:assert/strict'
import { cityGuideRoute, guideBearing, cityGuideMarkers, smoothGuideRotation } from '../src/javascript/World/cityGuideRules.js'

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

test('street arrows follow the player, point to the next turn and keep a bounded window', () =>
{
    const path = [[0, -30], [140, -30], [140, -35]]
    const first = cityGuideMarkers(path, 1, { x: 0, y: -30 })
    assert.equal(first.length, 28)
    assert.equal(cityGuideMarkers(path, 1, { x: .4, y: -30 })[0].x, 2.4)
    const player = { x: .4, y: -29 }
    const turned = cityGuideMarkers(path, 1, player)[0]
    assert.ok(Math.abs(Math.hypot(turned.x - player.x, turned.y - player.y) - 2) < 1e-9)
    assert.ok(Math.abs(turned.yaw - Math.atan2(-1, 139.6)) < 1e-9)
    const advanced = cityGuideMarkers(path, 1, { x: 8, y: -30 })
    assert.equal(advanced[0].x, 10)
    assert.equal(advanced.length, 28)
    assert.ok(cityGuideMarkers(path, 2, { x: 140, y: -32 }).every(p => p.x === 140))
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
