export const handoffThreshold = stakes => ({ HIGH: 92, MED: 80, LOW: 60 })[stakes]
export const needsHandoff = ({ stakes, confidence, mismatch = false }) => mismatch || confidence < handoffThreshold(stakes)
export const containmentChoice = item => item.verdict === 'auto' ? 'allow' : 'deny'
export function sentimentMedal(correct, total, sarcasmMisses = 0)
{
    const rate = total ? correct / total : 0
    return rate >= 0.96 && !sarcasmMisses ? 'gold' : rate >= 0.92 ? 'silver' : rate >= 0.87 ? 'bronze' : null
}
export function beatJudgement(distance, timing, boosted, gate = false)
{
    if(distance > 2.4 || gate && !boosted) return 'MISS'
    return distance <= 0.6 && Math.abs(timing) <= 0.06 ? 'PERFECT' : 'GOOD'
}
export function packetLoad(state, rack, count)
{
    if(state.loads[rack] > 0.8) state.p95 = Math.min(1, state.p95 + count * 0.15)
    state.loads[rack] = Math.min(1.3, state.loads[rack] + count * 0.12)
    state.served += count
}
export function coolPackets(state, dt)
{
    state.loads = state.loads.map(load => Math.max(0, load - dt * 0.06))
    state.p95 = Math.max(0, state.p95 - dt * 0.05)
    state.redTime = state.p95 > 0.8 ? state.redTime + dt : 0
    return state.redTime >= 3
}
export function shipStep(app, station, reject = false)
{
    if(station === 'CODE' && (app.phase === 'feature' || app.phase === 'fix')) app.phase = 'build'
    else if(app.phase === 'build' && station.startsWith('BUILD'))
    {
        app.builds.add(station)
        if(app.builds.size === 2) app.phase = 'review'
    }
    else if(station === 'REVIEW' && app.phase === 'review')
    {
        app.phase = reject ? 'fix' : 'shipped'
        if(reject) { app.rejections++; app.builds.clear() }
    }
    return app.phase
}
export function medalByCount(value, bronze, silver, gold) { return value >= gold ? 'gold' : value >= silver ? 'silver' : value >= bronze ? 'bronze' : null }
