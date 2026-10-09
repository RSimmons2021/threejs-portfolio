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

// A player-relative trail with continuous spacing through street corners.
// Runtime reuses the output objects, keeping per-frame updates allocation-light.
export function cityGuideMarkers(path, waypoint, position, limit = 28, markers = [])
{
    let count = 0, startX = position.x, startY = position.y, nextDistance = 2
    for(let i = Math.max(1, waypoint); i < path.length && count < limit; i++)
    {
        const end = path[i]
        const dx = end[0] - startX, dy = end[1] - startY, length = Math.hypot(dx, dy)
        if(length < .001) continue
        const yaw = Math.atan2(dy, dx)
        let distance = nextDistance
        for(; distance < length && count < limit; distance += 3)
        {
            const marker = markers[count] ||= { x: 0, y: 0, yaw: 0 }
            marker.x = startX + dx * distance / length
            marker.y = startY + dy * distance / length
            marker.yaw = yaw
            count++
        }
        nextDistance = distance - length
        startX = end[0]; startY = end[1]
    }
    markers.length = count
    return markers
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
