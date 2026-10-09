import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { renderPosition, renderQuaternion } from '../src/javascript/Utils/renderTransform.js'
import Time from '../src/javascript/Utils/Time.js'

test('render phase runs after all world ticks even when registered first', () =>
{
    const previous = globalThis.window
    globalThis.window = { requestAnimationFrame: () => 1, cancelAnimationFrame: () => {} }
    try
    {
        const time = new Time(), order = []
        time.on('render', () => order.push('render'))
        time.on('tick', () => order.push('physics'))
        time.on('tick', () => order.push('model'))
        time.current = performance.now() - 17
        time.tick(); time.stop()
        assert.deepEqual(order, ['physics', 'model', 'render'])
    }
    finally { globalThis.window = previous }
})

test('all render consumers read the same pose within one frame', () =>
{
    const body = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
    renderPosition(body, 1 / 60, 0)
    body.position.set(1, 0, 0)
    const model = renderPosition(body, 1 / 60, 1).clone()
    const camera = renderPosition(body, 1 / 60, 1).clone()
    assert.ok(model.distanceTo(camera) < 1e-9, `model/camera drift: ${model.distanceTo(camera)} m`)
    assert.ok(renderPosition(body, 1 / 60, 2).x > camera.x)
})

test('rotation and position share a single frame sample', () =>
{
    const body = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
    renderQuaternion(body, 1 / 60, 0)
    body.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.5)
    const model = renderQuaternion(body, 1 / 60, 1).clone()
    renderPosition(body, 1 / 60, 1)
    assert.ok(model.angleTo(renderQuaternion(body, 1 / 60, 1)) < 1e-7)
})
