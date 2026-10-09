// Slab intersection against expanded collision boxes. Called when a pickup /
// delivery destination changes, not per collider per frame.
export function intersectsFlightPath(start, end, box, clearance = 1.5)
{
    let low = 0, high = 1
    for(let i = 0; i < 3; i++)
    {
        const axis = ['x', 'y', 'z'][i]
        const min = box.min[axis] - clearance, max = box.max[axis] + clearance
        const delta = end[i] - start[i]
        if(Math.abs(delta) < 1e-8)
        {
            if(start[i] < min || start[i] > max) return false
        }
        else
        {
            const a = (min - start[i]) / delta, b = (max - start[i]) / delta
            low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b))
            if(low > high) return false
        }
    }
    return true
}

export function packetRoute(position, destination, colliders)
{
    const start = [position.x, position.y, position.z]
    const blockers = colliders.filter(box => intersectsFlightPath(start, destination, box))
    if(!blockers.length) return [destination]
    const height = Math.max(start[2], destination[2], ...blockers.map(box => box.max.z + 6))
    // Climb in the clear space above the pickup, cross above the obstructing
    // roofs, then descend directly into the receiving aperture.
    return [[start[0], start[1], height], [destination[0], destination[1], height], destination]
}
