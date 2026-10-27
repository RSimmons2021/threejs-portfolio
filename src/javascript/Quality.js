export const TIERS = Object.freeze({
    low: { dpr: 0.75, floor: 0.5, msaa: 0, bloom: 0, far: 100, lights: 4, beams: 12, traffic: 40, crowd: 18, rain: 100 },
    medium: { dpr: 1, floor: 0.6, msaa: 0, bloom: 3, far: 140, lights: 8, beams: 20, traffic: 70, crowd: 36, rain: 180 },
    high: { dpr: 1.25, floor: 0.75, msaa: 2, bloom: 4, far: 180, lights: 12, beams: 32, traffic: 110, crowd: 56, rain: 300 },
    ultra: { dpr: 1.5, floor: 0.85, msaa: 4, bloom: 5, far: 220, lights: 16, beams: 48, traffic: 160, crowd: 72, rain: 350 }
})
const NAMES = Object.keys(TIERS)

// GPU class from the WebGL renderer string (Chrome reports "ANGLE (vendor, model
// ...)", Safari masks Apple GPUs as "Apple GPU").
export function gpuClass(gpu = '')
{
    const g = gpu.toLowerCase()
    if(/swiftshader|llvmpipe|softpipe|software|microsoft basic/.test(g)) return 'software'
    const adreno = /adreno[^0-9]*(\d{3})/.exec(g)
    if(adreno) return Number(adreno[1]) >= 730 ? 'mobile-high' : Number(adreno[1]) >= 640 ? 'mobile-mid' : 'mobile-low'
    if(/immortalis|mali-g7[1-9]\d|mali-g9\d\d/.test(g)) return 'mobile-high'
    if(/mali-g(6\d|7[0-7]|5[27])\b|xclipse/.test(g)) return 'mobile-mid'
    if(/mali|powervr|videocore|tegra/.test(g)) return 'mobile-low'
    if(/apple m\d (pro|max|ultra)/.test(g)) return 'discrete'
    if(/apple (m\d|gpu)/.test(g)) return 'apple'
    if(/nvidia|geforce|quadro|rtx|gtx|radeon (rx|pro)|radeon\(tm\) rx|arc\(tm\) a|intel.*arc /.test(g)) return 'discrete'
    if(/iris\(r\) xe|iris xe|radeon(\(tm\))? (680m|780m|880m|890m)|arc\(tm\) graphics/.test(g)) return 'igpu-high'
    if(/intel|uhd|hd graphics|iris|radeon(\(tm\))? (vega|graphics)/.test(g)) return 'igpu-low'
    return 'unknown'
}

// Phones and tablets: their GPU name sets the tier, but they never go above
// High (thermal limits, not peak speed, decide a phone's frame rate).
const TIER_BY_CLASS = {
    desktop: { software: 'low', 'igpu-low': 'medium', 'igpu-high': 'high', apple: 'high', discrete: 'ultra', unknown: 'high',
        'mobile-low': 'medium', 'mobile-mid': 'medium', 'mobile-high': 'high' },
    mobile: { software: 'low', 'mobile-low': 'low', 'mobile-mid': 'medium', 'mobile-high': 'high', apple: 'medium', unknown: 'medium',
        'igpu-low': 'medium', 'igpu-high': 'high', discrete: 'high' }
}

export function detectTier({ mobile, touch = false, gpu = '', override = '' } = {})
{
    if(TIERS[override]) return override
    return TIER_BY_CLASS[(mobile ?? touch) ? 'mobile' : 'desktop'][gpuClass(gpu)]
}

// Platform, decided up front (a touch event can arrive long after loading).
export function isMobileDevice({ userAgent = '', uaMobile, maxTouchPoints = 0, coarsePointer = false } = {})
{
    if(typeof uaMobile === 'boolean' && uaMobile) return true
    if(/android|iphone|ipod|mobile|silk|kindle/i.test(userAgent)) return true
    // iPadOS reports a desktop Mac user agent.
    if(/macintosh/i.test(userAgent) && maxTouchPoints > 1) return true
    return /ipad|tablet/i.test(userAgent) || (coarsePointer && maxTouchPoints > 0 && !/windows|linux x86|cros/i.test(userAgent))
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
