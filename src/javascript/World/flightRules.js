// Shared by free flight and sky-access entrances. Authored rooftop courses
// retain their own, lower play envelope.
export const FLIGHT_CEILING = 160
export const SOFT_CEILING = 150
// With the Megacity ring loaded the sky opens up above its ~450 m towers.
export const MEGACITY_CEILING = 520

export function ceilingVelocity(height, requested, ceiling = FLIGHT_CEILING)
{
    const soft = ceiling - (FLIGHT_CEILING - SOFT_CEILING)
    if(height > ceiling) return Math.min(requested, -(height - ceiling) * 2)
    return height > soft ? Math.min(requested, (ceiling - height) * 0.8) : requested
}
