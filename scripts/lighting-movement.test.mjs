import test from 'node:test'
import assert from 'node:assert/strict'
import { movementVector, joystickWorldYaw } from '../src/javascript/World/movementRules.js'
import { spillBudget, MAX_SPILL_LIGHTS } from '../src/javascript/World/NeonLightRig.js'
import { TIERS } from '../src/javascript/Quality.js'

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`)

test('W and D follow each of the four camera headings', () => {
    for(const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
        const f = movementVector(1, 0, yaw, 3.2), r = movementVector(0, 1, yaw, 3.2)
        near(f.x, Math.cos(yaw) * 3.2); near(f.y, Math.sin(yaw) * 3.2)
        near(r.x, Math.sin(yaw) * 3.2); near(r.y, -Math.cos(yaw) * 3.2)
        near(f.x * r.x + f.y * r.y, 0)
    }
})

test('Diagonal and reverse input keep their speed and sign', () => {
    const diagonal = movementVector(1, 1, 0.8, 7.6)
    near(Math.hypot(diagonal.x, diagonal.y), 7.6)
    const forward = movementVector(1, 0, -1.2), reverse = movementVector(-1, 0, -1.2)
    near(forward.x, -reverse.x); near(forward.y, -reverse.y)
    assert.deepEqual(movementVector(0, 0, 0), { x: 0, y: 0 })
})

test('Touch heading matches walking, drive and flight for any camera orbit', () => {
    for(const yaw of [-3, -1, 0, 2.5]) for(const angle of [0, 0.6, Math.PI / 2, Math.PI]) {
        const world = joystickWorldYaw(angle, yaw)
        const vector = movementVector(Math.sin(angle), Math.cos(angle), yaw)
        near(vector.x, Math.cos(world)); near(vector.y, Math.sin(world))
    }
})

test('Spill light loops stay bounded and drop with quality', () => {
    assert.equal(spillBudget(TIERS.low), 2)
    assert.equal(spillBudget(TIERS.medium), 4)
    assert.equal(spillBudget(TIERS.ultra), MAX_SPILL_LIGHTS)
    assert.equal(spillBudget({ ...TIERS.ultra, bloom: 0 }), 2)
    assert.equal(spillBudget({ ...TIERS.ultra, lights: 1 }), 1)
})
