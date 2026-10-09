import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import VisitorGuide from '../src/javascript/World/VisitorGuide.js'
import GuideTrail from '../src/javascript/World/GuideTrail.js'
import { guideWaypoint, guideNeedsReroute } from '../src/javascript/World/cityGuideRules.js'

test('actual render phase moves the lead from the smoothed pose without moving the street ribbon', () =>
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
    guide.trail.setGroundPath(guide.path)
    guide.drawMarkers()
    const before = Array.from(guide.markers.instanceMatrix.array.slice(0, 16))
    const anchored = Array.from(guide.markers.instanceMatrix.array.slice(16, 32))
    const version = guide.ribbon.geometry.attributes.position.version
    position.set(.4, -29, .5)
    guide.updateBearing()
    const after = Array.from(guide.markers.instanceMatrix.array.slice(0, 16))
    assert.notDeepEqual(after, before, 'rendering must move and turn the trail even between 250 ms label updates')
    assert.ok(Math.abs(Math.hypot(after[12] - position.x, after[13] - position.y) - 2) < .001)
    assert.ok(Math.atan2(after[1], after[0]) < 0, 'lead corrects lateral drift toward the route')
    assert.deepEqual(Array.from(guide.markers.instanceMatrix.array.slice(16, 32)), anchored)
    assert.equal(guide.ribbon.geometry.attributes.position.version, version, 'ground geometry is not uploaded each frame')
    assert.ok(guide.markers.count <= 7, 'fewer street chevrons in a bounded lookahead')
    position.set(5, -29, 12)
    guide.updateBearing()
    const airborne = guide.markers.instanceMatrix.array
    assert.ok(guide.markers.visible)
    assert.ok(Math.abs(airborne[14] - 11.25) < .001)
    position.set(guide.destination.x, guide.destination.y, 12)
    for(let i = 0; i < 30; i++) guide.updateBearing()
    assert.equal(guide.markers.visible, true, 'overhead is not arrival: keep showing descent')
    assert.ok(guide.markers.instanceMatrix.array[2] < -.9, 'lead arrow points down the light column')
    position.z = .5
    guide.updateBearing()
    assert.equal(guide.markers.visible, false, 'touchdown hides the trail but keeps the information UI')
    assert.equal(guide.ribbon.visible, false)
    guide.markers.geometry.dispose()
    guide.markerMaterial.dispose()
    guide.markers.dispose()
    guide.ribbon.geometry.dispose()
    guide.trail.ribbonMaterial.dispose()
})

test('guide advances a missed turn and recovers off-route', () =>
{
    const path = [[0, -30], [40, -30], [40, -35]]
    assert.equal(guideWaypoint(path, 1, { x: 45, y: -30 }), 2)
    assert.equal(guideWaypoint(path, 1, { x: 20, y: -30 }), 1)
    assert.equal(guideNeedsReroute(path, 1, { x: 20, y: -29 }), false)
    assert.equal(guideNeedsReroute(path, 1, { x: 20, y: -40 }), true)
})

test('lead anticipates a corner without the previous 79 degree waypoint snap', () =>
{
    const group = new THREE.Group(), trail = new GuideTrail(group), destination = { x: 30, y: -45 }
    trail.setGroundPath([[0,-30], [30,-30], [30,-45]])
    trail.update({ x: 26.9, y: -30, z: .5 }, destination, 1 / 60, true)
    const before = trail.leadYaw
    trail.update({ x: 27.1, y: -30, z: .5 }, destination, 1 / 60, true)
    assert.ok(Math.abs(trail.leadYaw - before) < 8, `turn changed ${Math.abs(trail.leadYaw - before)} degrees`)
    assert.ok(before < -20, 'turn is visible before entering the corner')
    assert.equal(group.children.length, 2, 'only two bounded batches and no lights')
    assert.equal(trail.markers.instanceMatrix.count, 16)
    assert.equal(trail.ribbon.geometry.attributes.position.count, 128)
    assert.equal(trail.markerMaterial.depthWrite, false)
    assert.equal(trail.ribbonMaterial.depthWrite, false)
    trail.clear()
    assert.equal(trail.markers.visible, false)
    assert.equal(trail.ribbon.visible, false)
    assert.equal(trail.ribbon.geometry.drawRange.count, 0)
    trail.markers.geometry.dispose(); trail.markerMaterial.dispose(); trail.markers.dispose()
    trail.ribbon.geometry.dispose(); trail.ribbonMaterial.dispose()
})

test('mobile details disclosure preserves native semantics and keyboard focus', () =>
{
    const guide = Object.create(VisitorGuide.prototype), attributes = {}
    guide.$details = { hidden: false }
    guide.$detailsToggle = { setAttribute: (key, value) => { attributes[key] = value } }
    guide.$route = { dataset: {} }
    guide.compactQuery = { matches: true }
    guide.setDetails(false)
    assert.equal(guide.$details.hidden, true)
    assert.equal(attributes['aria-expanded'], 'false')
    guide.setDetails(true)
    assert.equal(guide.$details.hidden, false)
    assert.equal(attributes['aria-expanded'], 'true')
    guide.compactQuery.matches = false
    guide.setDetails(false)
    assert.equal(guide.$details.hidden, false, 'desktop actions stay available without disclosure')
})

test('near chevrons stay anchored until fully faded and vertical ribbons do not twist', () =>
{
    const trail = new GuideTrail(new THREE.Group()), destination = { x: 40, y: -35 }
    trail.setGroundPath([[0,-30], [40,-30], [40,-35]])
    trail.update({ x: 0, y: -30, z: .5 }, destination, 1 / 60, false)
    const near = Array.from(trail.markers.instanceMatrix.array.slice(16, 32))
    trail.update({ x: 3, y: -30, z: .5 }, destination, 1 / 60, false)
    assert.deepEqual(Array.from(trail.markers.instanceMatrix.array.slice(16, 32)), near, 'a 7m chevron must not disappear abruptly after only 2m of travel')
    trail.update({ x: 40, y: -75, z: 40 }, destination, 1 / 60, true)
    const path = trail.flightPoints, positions = trail.ribbon.geometry.attributes.position
    const a = (path.length - 2) * 2, b = (path.length - 1) * 2
    assert.ok(Math.abs(positions.getX(a) - positions.getX(b)) < .001)
    assert.ok(Math.abs(positions.getY(a) - positions.getY(b)) < .001)
    trail.markers.geometry.dispose(); trail.markerMaterial.dispose(); trail.markers.dispose()
    trail.ribbon.geometry.dispose(); trail.ribbonMaterial.dispose()
})
