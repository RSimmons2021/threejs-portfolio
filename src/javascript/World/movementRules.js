// Z-up, camera-relative input. Right is clockwise from the ground-plane view.
export function movementVector(forward, right, yaw, speed = 1)
{
    const scale = speed / Math.max(1, Math.hypot(forward, right))
    return { x: (Math.cos(yaw) * forward + Math.sin(yaw) * right) * scale,
        y: (Math.sin(yaw) * forward - Math.cos(yaw) * right) * scale }
}

export function joystickWorldYaw(angle, viewYaw)
{
    return viewYaw + angle - Math.PI / 2
}

// A chasing camera must not rotate the basis of a held walking gesture.
// Capture at press/touch start; a release or deliberate view drag retargets it.
export function heldMovementYaw(state, forward, right, viewYaw, explicitLook = false)
{
    const held = Math.hypot(forward, right) > .05
    if(!held || !state.held || explicitLook) state.yaw = viewYaw
    state.held = held
    return state.yaw
}
