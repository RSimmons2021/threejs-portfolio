export const STARTER_CREDITS = 300

// Upgrade old saves once, without resetting earned credits, stats or inventory.
export function withStarterCredits(state)
{
    if(state.starterCreditsGranted) return state
    const earned = Number.isFinite(state.credits) ? Math.max(0, state.credits) : 0
    return { ...state, credits: earned + STARTER_CREDITS, starterCreditsGranted: true }
}
