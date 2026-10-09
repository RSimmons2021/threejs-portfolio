import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import VisitorGuide from '../src/javascript/World/VisitorGuide.js'
import { cityGuideMarkers, guideWaypoint, guideNeedsReroute } from '../src/javascript/World/cityGuideRules.js'

test('actual guide render phase moves and turns street arrows from the smoothed player pose', () =>
{
    const guide = Object.create(VisitorGuide.prototype)
    const position = new THREE.Vector3(0, -30, .5)
    guide.world = {
        explorer: { position: new THREE.Vector3(0, -30, .5), renderPosition: position },
        time: { delta: 1000 / 60 }, config: { reducedMotion: false },
        controls: { getViewYaw: () => 0 }
    }
    guide.container = new THREE.Group()
    guide.path = [[0, -30], [40, -30], [40, -35]]
    guide.waypoint = 1
    guide.destination = { group: 'projects', x: 40, y: -35 }
    guide.$route = { hidden: false }
    guide.$bearing = { style: {} }
    guide.bearingRotation = null
    guide.buildMarkers()
    guide.drawMarkers()
    const before = Array.from(guide.markers.instanceMatrix.array.slice(0, 16))
    position.set(.4, -29, .5)
    guide.updateBearing()
    const after = Array.from(guide.markers.instanceMatrix.array.slice(0, 16))
    assert.notDeepEqual(after, before, 'rendering must move and turn the trail even between 250 ms label updates')
    assert.ok(Math.abs(Math.hypot(after[12] - position.x, after[13] - position.y) - 2) < .001)
    assert.ok(Math.abs(Math.atan2(after[1], after[0]) - Math.atan2(-1, 39.6)) < .001)
    assert.equal(guide.markers.count, 15)
    position.set(5, -29, 12)
    guide.updateBearing()
    const airborne = guide.markers.instanceMatrix.array
    assert.ok(guide.markers.visible)
    assert.ok(Math.abs(airborne[14] - 11.25) < .001)
    assert.ok(Math.abs(Math.atan2(airborne[1], airborne[0]) - Math.atan2(-6, 35)) < .001)
    position.set(guide.destination.x, guide.destination.y, 12)
    guide.updateBearing()
    assert.equal(guide.markers.visible, false, 'arrival hides the trail but keeps the information UI')
    guide.markers.geometry.dispose()
    guide.markerMaterial.dispose()
    guide.markers.dispose()
})

test('guide advances a missed turn, recovers off-route and samples corners continuously', () =>
{
    const path = [[0, -30], [40, -30], [40, -35]]
    assert.equal(guideWaypoint(path, 1, { x: 45, y: -30 }), 2)
    assert.equal(guideWaypoint(path, 1, { x: 20, y: -30 }), 1)
    assert.equal(guideNeedsReroute(path, 1, { x: 20, y: -29 }), false)
    assert.equal(guideNeedsReroute(path, 1, { x: 20, y: -40 }), true)
    const markers = cityGuideMarkers([[0,0], [4,0], [4,10]], 1, { x: 0, y: 0 })
    assert.deepEqual(markers.slice(0, 2), [{ x: 2, y: 0, yaw: 0 }, { x: 4, y: 1, yaw: Math.PI / 2 }])
    const pool = []
    cityGuideMarkers(path, 1, { x: 0, y: -30 }, 28, pool)
    const first = pool[0]
    cityGuideMarkers(path, 1, { x: .4, y: -30 }, 28, pool)
    assert.equal(pool[0], first, 'the render loop reuses marker records')
})
