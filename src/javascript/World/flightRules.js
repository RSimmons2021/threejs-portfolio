// Shared by free flight and sky-access entrances. Authored rooftop courses
// retain their own, lower play envelope.
export const FLIGHT_CEILING = 160
export const SOFT_CEILING = 150

export function ceilingVelocity(height, requested)
{
    if(height > FLIGHT_CEILING) return Math.min(requested, -(height - FLIGHT_CEILING) * 2)
    return height > SOFT_CEILING ? Math.min(requested, (FLIGHT_CEILING - height) * 0.8) : requested
}
