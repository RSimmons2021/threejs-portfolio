// Follow authored street spines rather than directing visitors through towers.
export function cityGuideRoute(position, destination)
{
    if(Math.hypot(destination.x - position.x, destination.y - position.y) < 3)
        return [[position.x, position.y], [destination.x, destination.y]]
    const points = [[position.x, position.y], [position.x, -30]]
    if(destination.group === 'projects') points.push([destination.x, -30])
    else if(destination.group === 'play') points.push([-22, -30], [-22, destination.y])
    else points.push([0, -30], [0, destination.y])
    points.push([destination.x, destination.y])
    return points.filter((point, index) => index === 0 || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > .5)
}

export function guideBearing(position, target, viewYaw)
{
    const delta = Math.atan2(target[1] - position.y, target[0] - position.x) - viewYaw
    const angle = Math.atan2(Math.sin(delta), Math.cos(delta))
    return { rotation: -angle * 180 / Math.PI, direction: Math.abs(angle) < .45 ? 'Ahead' : Math.abs(angle) > 2.7 ? 'Behind you' : angle > 0 ? 'Left' : 'Right' }
}

// Unwrap across ±180° and damp by elapsed time, not by frame count.
export function smoothGuideRotation(current, target, deltaSeconds, reducedMotion = false)
{
    if(current === null) return target
    const delta = Math.atan2(Math.sin((target - current) * Math.PI / 180), Math.cos((target - current) * Math.PI / 180)) * 180 / Math.PI
    return current + delta * (reducedMotion ? 1 : 1 - Math.exp(-Math.min(deltaSeconds, .1) * 18))
}

// Round only the immediate street junction, never overshoot a street spine.
// Cache this world-space path on selection/reroute; do not drag it with the car.
export function roundedGuidePath(path)
{
    const result = []
    const append = (x, y, z = .09) =>
    {
        const previous = result[result.length - 1]
        const length = previous ? Math.hypot(x - previous.x, y - previous.y, z - previous.z) : 0
        if(previous && length < .0001) return
        result.push({ x, y, z, s: (previous?.s || 0) + length })
    }
    append(path[0][0], path[0][1])
    for(let i = 1; i < path.length - 1; i++)
    {
        const a = path[i - 1], b = path[i], c = path[i + 1]
        const incoming = Math.hypot(b[0] - a[0], b[1] - a[1]), outgoing = Math.hypot(c[0] - b[0], c[1] - b[1])
        const radius = Math.min(2.4, incoming * .25, outgoing * .25)
        if(radius < .001) { append(b[0], b[1]); continue }
        const ax = b[0] - (b[0] - a[0]) * radius / incoming, ay = b[1] - (b[1] - a[1]) * radius / incoming
        const cx = b[0] + (c[0] - b[0]) * radius / outgoing, cy = b[1] + (c[1] - b[1]) * radius / outgoing
        append(ax, ay)
        for(let step = 1; step <= 8; step++)
        {
            const t = step / 8, u = 1 - t
            append(u * u * ax + 2 * u * t * b[0] + t * t * cx, u * u * ay + 2 * u * t * b[1] + t * t * cy)
        }
    }
    const end = path[path.length - 1]
    append(end[0], end[1])
    return result
}

// These helpers mutate pooled records rather than allocating in the render loop.
export function sampleGuidePath(path, distance, sample = {})
{
    let index = 1
    while(index < path.length - 1 && path[index].s < distance) index++
    const a = path[Math.max(0, index - 1)], b = path[Math.min(index, path.length - 1)]
    const t = Math.max(0, Math.min(1, (distance - a.s) / Math.max(.0001, b.s - a.s)))
    sample.x = a.x + (b.x - a.x) * t
    sample.y = a.y + (b.y - a.y) * t
    sample.z = a.z + (b.z - a.z) * t
    sample.yaw = Math.atan2(b.y - a.y, b.x - a.x)
    sample.pitch = Math.atan2(b.z - a.z, Math.hypot(b.x - a.x, b.y - a.y))
    return sample
}

export function projectGuidePath(path, position)
{
    let best = Infinity, distance = 0
    for(let i = 1; i < path.length; i++)
    {
        const a = path[i - 1], b = path[i]
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z
        const squared = dx * dx + dy * dy + dz * dz
        const t = squared > 0 ? Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.y - a.y) * dy + (position.z - a.z) * dz) / squared)) : 0
        const gap = (position.x - a.x - dx * t) ** 2 + (position.y - a.y - dy * t) ** 2 + (position.z - a.z - dz * t) ** 2
        if(gap < best) { best = gap; distance = a.s + (b.s - a.s) * t }
    }
    return distance
}

// Approach at the visitor's altitude, then bend down inside the destination's
// open light column. Do not imply landing until the player is actually near ground.
export function flightGuidePath(position, destination, points = [])
{
    let count = 0, length = 0
    const append = (x, y, z) =>
    {
        const previous = count > 0 ? points[count - 1] : null
        if(previous) length += Math.hypot(x - previous.x, y - previous.y, z - previous.z)
        const point = points[count] ||= {}
        point.x = x; point.y = y; point.z = z; point.s = length
        count++
    }
    const height = Math.max(.09, position.z - .75)
    const dx = destination.x - position.x, dy = destination.y - position.y, horizontal = Math.hypot(dx, dy)
    const radius = Math.min(5, horizontal * .25, (height - .09) * .25)
    append(position.x, position.y, height)
    if(radius > .001)
    {
        const ax = destination.x - dx * radius / horizontal, ay = destination.y - dy * radius / horizontal
        append(ax, ay, height)
        for(let step = 1; step <= 8; step++)
        {
            const t = step / 8, u = 1 - t
            append(u * u * ax + (2 * u * t + t * t) * destination.x, u * u * ay + (2 * u * t + t * t) * destination.y, height - t * t * radius)
        }
    }
    append(destination.x, destination.y, .09)
    points.length = count
    return points
}

export function guideArrived(position, destination)
{
    return position.z <= 3 && Math.hypot(destination.x - position.x, destination.y - position.y) < 3
}

export function guideWaypoint(path, waypoint, position)
{
    while(waypoint < path.length - 1)
    {
        const end = path[waypoint], start = path[waypoint - 1]
        const dx = end[0] - start[0], dy = end[1] - start[1], lengthSquared = dx * dx + dy * dy
        const px = position.x - end[0], py = position.y - end[1]
        const passed = px * dx + py * dy > 0 && lengthSquared > 0 && Math.abs(px * dy - py * dx) / Math.sqrt(lengthSquared) < 3
        if(Math.hypot(px, py) >= 3 && !passed) break
        waypoint++
    }
    return waypoint
}

export function guideNeedsReroute(path, waypoint, position)
{
    const start = path[waypoint - 1], end = path[waypoint]
    const dx = end[0] - start[0], dy = end[1] - start[1], lengthSquared = dx * dx + dy * dy
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, ((position.x - start[0]) * dx + (position.y - start[1]) * dy) / lengthSquared)) : 0
    return Math.hypot(position.x - start[0] - dx * t, position.y - start[1] - dy * t) > 6
}
