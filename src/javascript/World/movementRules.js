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
