import * as THREE from 'three'

/**
 * Smooths what gets drawn without changing what gets simulated.
 *
 * Physics runs on fixed 1/60 steps via world.step(1/60, delta, 3). Frames are
 * not 1/60 apart, so a frame consumes two substeps and the next three, and
 * anything drawn straight from body.position advances in uneven lurches. That
 * unevenness is the judder, and it is worst on a slow device where the substep
 * count swings most.
 *
 * Cannon's own body.interpolatedPosition is not the answer. Despite the name it
 * EXTRAPOLATES — position + (position - previousPosition) * (time % dt) / dt —
 * projecting ahead of the last completed step using only that step's delta.
 * When the substep cap is hit the world clock still advances by the full frame
 * time, so that factor decouples from real progress and the prediction wanders.
 * Rendering from it looks worse than rendering raw.
 *
 * So this smooths towards the authoritative position instead of guessing past
 * it: an exponential follower, framerate independent, that cannot overshoot.
 * Gameplay still reads body.position; only the visible transform comes here.
 */

// Time constant. Higher tracks more tightly and smooths less; 26/s settles in
// roughly 40ms, enough to absorb a dropped substep without feeling detached.
const RATE = 26

// Further than a stride from the body is a teleport, not motion. Snap, or the
// walker would visibly glide across the city on entering an interior.
const SNAP_DISTANCE_SQUARED = 4

const states = new WeakMap()

export function renderPosition(_body, _delta)
{
    let state = states.get(_body)
    if(!state)
    {
        state = { position: new THREE.Vector3().copy(_body.position) }
        states.set(_body, state)
        return state.position
    }

    const target = _body.position
    const dx = target.x - state.position.x
    const dy = target.y - state.position.y
    const dz = target.z - state.position.z

    if(dx * dx + dy * dy + dz * dz > SNAP_DISTANCE_SQUARED)
    {
        state.position.set(target.x, target.y, target.z)
        return state.position
    }

    const alpha = 1 - Math.exp(- RATE * Math.min(_delta, 0.1))
    state.position.x += dx * alpha
    state.position.y += dy * alpha
    state.position.z += dz * alpha
    return state.position
}

export function renderQuaternion(_body, _delta)
{
    let state = states.get(_body)
    if(!state || !state.quaternion)
    {
        const quaternion = new THREE.Quaternion(_body.quaternion.x, _body.quaternion.y, _body.quaternion.z, _body.quaternion.w)
        if(state) state.quaternion = quaternion
        else states.set(_body, { position: new THREE.Vector3().copy(_body.position), quaternion })
        return quaternion
    }

    const alpha = 1 - Math.exp(- RATE * Math.min(_delta, 0.1))
    tempQuaternion.set(_body.quaternion.x, _body.quaternion.y, _body.quaternion.z, _body.quaternion.w)
    state.quaternion.slerp(tempQuaternion, alpha)
    return state.quaternion
}

const tempQuaternion = new THREE.Quaternion()
