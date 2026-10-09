export const TIERS = Object.freeze({
    low: { dpr: 0.75, floor: 0.5, msaa: 0, bloom: 0, far: 100, lights: 4, beams: 12, traffic: 60, crowd: 18, rain: 100 },
    medium: { dpr: 1, floor: 0.6, msaa: 0, bloom: 3, far: 140, lights: 8, beams: 20, traffic: 140, crowd: 36, rain: 180 },
    high: { dpr: 1.25, floor: 0.75, msaa: 2, bloom: 4, far: 180, lights: 12, beams: 32, traffic: 250, crowd: 56, rain: 300 },
    ultra: { dpr: 1.5, floor: 0.85, msaa: 4, bloom: 5, far: 220, lights: 16, beams: 48, traffic: 400, crowd: 72, rain: 350 }
})
const NAMES = Object.keys(TIERS)

export function detectTier({ touch = false, gpu = '', override = '' } = {})
{
    if(TIERS[override]) return override
    if(touch) return 'medium'
    if(/swiftshader|llvmpipe|software/i.test(gpu)) return 'low'
    return /intel|uhd|iris|mali|adreno|powervr|apple|radeon.*graphics/i.test(gpu) ? 'high' : 'ultra'
}

export default class Quality
{
    constructor({ tier = 'medium', deviceDpr = 1, onChange = () => {} } = {})
    {
        this.deviceDpr = deviceDpr
        this.onChange = onChange
        if(!TIERS[tier]) tier = 'medium'
        this.initialTier = tier
        this.msaaCeiling = TIERS[tier].msaa
        this.maxTier = Math.min(NAMES.indexOf(tier) + 1, NAMES.length - 1)
        this.lastChange = -Infinity
        this.samples = []
        this.fastWindows = 0
        this.msaaDropped = false
        this.select(tier, false)
    }

    select(tier, notify = true)
    {
        if(!TIERS[tier]) return
        this.tier = tier
        this.settings = { ...TIERS[tier] }
        this.settings.dpr = Math.min(this.deviceDpr, this.settings.dpr)
        this.settings.msaa = this.msaaDropped ? 0 : Math.min(this.msaaCeiling, this.settings.msaa)
        this.rung = 0
        this.fastWindows = 0
        this.samples.length = 0
        if(notify) this.onChange(this.settings, this)
    }

    sample(ms, now)
    {
        // Use the raw wall-clock frame delta, never the clamped physics delta.
        if(!Number.isFinite(ms) || ms <= 0) return false
        this.samples.push(ms)
        if(this.samples.length < 45) return false
        const average = this.samples.reduce((a, b) => a + b, 0) / this.samples.length
        this.samples.length = 0
        this.fastWindows = average < 16 ? this.fastWindows + 1 : 0
        if(now - this.lastChange < 3000) return false
        if(average > 26) this.down()
        else if(this.fastWindows >= 3) this.up()
        else return false
        this.lastChange = now
        this.onChange(this.settings, this)
        return true
    }

    down()
    {
        const s = this.settings
        if(s.dpr > TIERS[this.tier].floor + 0.01) { s.dpr = Math.max(TIERS[this.tier].floor, s.dpr - 0.1); return }
        if(s.msaa) { s.msaa = 0; this.msaaDropped = true; this.rung = 1; return }
        if(s.bloom) { s.bloom--; this.rung = 2; return }
        if(this.rung < 3) { s.traffic = Math.max(24, Math.floor(s.traffic * 0.6)); this.rung = 3; return }
        if(this.rung < 4) { s.crowd = Math.max(12, Math.floor(s.crowd * 0.6)); this.rung = 4; return }
        if(s.far > 80) { s.far = Math.max(80, s.far - 20); this.rung = 5; return }
        const index = NAMES.indexOf(this.tier)
        if(index > 0)
        {
            // A slower tier must not jump back up to its default resolution
            // or draw distance after those budgets have already been shed.
            const previous = { ...s }
            this.select(NAMES[index - 1], false)
            for(const key of ['dpr', 'msaa', 'bloom', 'far', 'traffic', 'crowd'])
                this.settings[key] = Math.min(this.settings[key], previous[key])
        }
    }

    up()
    {
        this.fastWindows = 0
        const cap = Math.min(this.deviceDpr, TIERS[this.tier].dpr)
        if(this.settings.dpr < cap - 0.01) { this.settings.dpr = Math.min(cap, this.settings.dpr + 0.1); return }
        // Recovery is deliberately conservative. MSAA is never rebuilt back on.
        const index = NAMES.indexOf(this.tier)
        if(index < this.maxTier) this.select(NAMES[index + 1], false)
    }
}
