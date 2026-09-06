export const SPRINT_GATES = [
    { x: 5, y: -29, direction: 1 }, { x: 53, y: -29, direction: 1 },
    { x: 101, y: -29, direction: 1 }, { x: 145, y: -29, direction: 1 },
    { x: 137, y: -35, direction: -1 }, { x: 89, y: -35, direction: -1 },
    { x: 41, y: -35, direction: -1 }, { x: -20, y: -35, direction: -1 }
]

export const ARCADE_BOUNDS = Object.freeze({
    minX: -59,
    maxX: -17,
    minY: -58,
    maxY: -25
})

export function isInsideArcade(position, bounds = ARCADE_BOUNDS)
{
    return position.x >= bounds.minX && position.x <= bounds.maxX &&
        position.y >= bounds.minY && position.y <= bounds.maxY
}

// Swept crossing prevents fast cars from skipping a gate between frames.
export function crossedGate(previous, current, gate)
{
    const dx = current.x - previous.x
    if(dx * gate.direction <= 0 || Math.abs(dx) > 12) return false
    const t = (gate.x - previous.x) / dx
    if(t < 0 || t > 1) return false
    const y = previous.y + (current.y - previous.y) * t
    return Math.abs(y - gate.y) <= 2.5 && current.z < 2
}

export function medalFor(game, score)
{
    if(game === 'sprint') return score <= 32 ? 'GOLD' : score <= 42 ? 'SILVER' : 'BRONZE'
    return score >= 25 ? 'GOLD' : score >= 18 ? 'SILVER' : score >= 10 ? 'BRONZE' : 'KEEP ROLLING'
}

export function readBest(storage)
{
    try
    {
        const data = JSON.parse(storage.getItem('portfolio-arcade-v1'))
        const sprint = Number.isFinite(data?.sprint) && data.sprint > 0 && data.sprint <= 75 ? data.sprint : null
        const bowling = Number.isInteger(data?.bowling) && data.bowling >= 0 && data.bowling <= 30 ? data.bowling : 0
        const ghost = sprint && Array.isArray(data?.ghost) && data.ghost.length <= 1000 && data.ghost.every(p =>
            Array.isArray(p) && p.length === 5 && p.every(Number.isFinite) && p[0] >= 0 && p[0] <= 75 && Math.abs(p[1]) < 200 && Math.abs(p[2]) < 100 && Math.abs(p[3]) < 20
        ) ? data.ghost : []
        return { sprint, bowling, ghost }
    }
    catch { return { sprint: null, bowling: 0, ghost: [] } }
}

export function writeBest(storage, best)
{
    try { storage.setItem('portfolio-arcade-v1', JSON.stringify(best)); return true }
    catch { return false }
}
