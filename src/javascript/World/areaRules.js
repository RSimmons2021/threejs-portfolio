import { FLIGHT_CEILING } from './flightRules.js'

export const ENTRY_HEIGHT = FLIGHT_CEILING + 2

export function isInsideArea(area, position, airborne = false)
{
    if(airborne && !area.skyAccess) return false
    const floor = area.floorZ || 0
    const top = floor + (area.skyAccess ? area.entryHeight : 3)
    return Math.abs(position.x - area.position.x) < Math.abs(area.halfExtents.x)
        && Math.abs(position.y - area.position.y) < Math.abs(area.halfExtents.y)
        && position.z >= floor - 1 && position.z <= top
}
