// Gains are intentionally modest: dialogue/interaction feedback stays audible.
export function vehicleAudioMix(state, started, duck, flightBlend)
{
    const active = started && !state?.onFoot
    const speed = Math.min(Math.max(state?.speed || 0, 0), 1)
    return {
        drive: active ? (1 - flightBlend) * duck : 0,
        hover: active ? flightBlend * (0.16 + speed * 0.09 + (state?.boost ? 0.035 : 0)) * duck : 0,
        air: active ? flightBlend * (0.018 + speed * speed * 0.052) * duck : 0
    }
}

export function cityAudioGain(state, started, duck)
{
    if(!started) return 0
    // Distant traffic fades below the player at roof / skyline height.
    const distance = state?.flying ? Math.max(0.25, 1 / (1 + Math.max(0, state.altitude || 0) / 45)) : 1
    return 0.06 * distance * (state?.indoors ? 0.35 : 1) * duck
}
