import { Howler } from 'howler'

/**
 * Procedural ambient soundscape — everything is synthesized with Web Audio
 * (no audio files): rain patter (filtered noise), wind for fog/snow, cricket
 * chirps at night and bird chirps by day. All nodes route through
 * Howler.masterGain so the global mute/volume keeps working.
 */
export default class AmbientSounds
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.weather = _options.weather
        this.dayNightCycle = _options.dayNightCycle
        this.debug = _options.debug

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.masterVolume = 0.5

        this.started = false
        this.nextCricketIn = 1500
        this.nextBirdIn = 3000

        // Web Audio context comes from Howler (already resumed by the user's click)
        this.context = Howler.ctx
        this.destination = Howler.masterGain

        if(!this.context || !this.destination)
        {
            return
        }

        this.setNodes()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('ambientSounds')
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this.settings, 'masterVolume').min(0).max(1).step(0.05).name('volume')
        }
    }

    setNodes()
    {
        const ctx = this.context

        // Master ambient gain
        this.masterGain = ctx.createGain()
        this.masterGain.gain.value = 0
        this.masterGain.connect(this.destination)

        // Shared 2s looping white-noise buffer
        const sampleCount = ctx.sampleRate * 2
        this.noiseBuffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate)
        const data = this.noiseBuffer.getChannelData(0)
        for(let i = 0; i < sampleCount; i++)
        {
            data[i] = Math.random() * 2 - 1
        }

        // Rain: noise -> lowpass -> gain
        this.rainSource = ctx.createBufferSource()
        this.rainSource.buffer = this.noiseBuffer
        this.rainSource.loop = true
        this.rainFilter = ctx.createBiquadFilter()
        this.rainFilter.type = 'lowpass'
        this.rainFilter.frequency.value = 1300
        this.rainGain = ctx.createGain()
        this.rainGain.gain.value = 0
        this.rainSource.connect(this.rainFilter)
        this.rainFilter.connect(this.rainGain)
        this.rainGain.connect(this.masterGain)
        this.rainSource.start()

        // Wind (fog / snow): noise -> narrow bandpass with a slow LFO wobble -> gain
        this.windSource = ctx.createBufferSource()
        this.windSource.buffer = this.noiseBuffer
        this.windSource.loop = true
        this.windFilter = ctx.createBiquadFilter()
        this.windFilter.type = 'bandpass'
        this.windFilter.frequency.value = 320
        this.windFilter.Q.value = 1.6
        this.windGain = ctx.createGain()
        this.windGain.gain.value = 0
        this.windSource.connect(this.windFilter)
        this.windFilter.connect(this.windGain)
        this.windGain.connect(this.masterGain)
        this.windSource.start()

        this.windLfo = ctx.createOscillator()
        this.windLfo.frequency.value = 0.13
        this.windLfoGain = ctx.createGain()
        this.windLfoGain.gain.value = 90
        this.windLfo.connect(this.windLfoGain)
        this.windLfoGain.connect(this.windFilter.frequency)
        this.windLfo.start()

        this.started = true
    }

    // One cricket chirp: a short burst of high-pitched pulses
    playCricket(_loudness)
    {
        const ctx = this.context
        const now = ctx.currentTime

        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = 4100 + Math.random() * 600

        const gain = ctx.createGain()
        gain.gain.value = 0

        const pulses = 3 + Math.floor(Math.random() * 4)
        const pulseLength = 0.045
        for(let i = 0; i < pulses; i++)
        {
            const start = now + i * pulseLength * 1.6
            gain.gain.setValueAtTime(0, start)
            gain.gain.linearRampToValueAtTime(0.014 * _loudness, start + pulseLength * 0.3)
            gain.gain.linearRampToValueAtTime(0, start + pulseLength)
        }

        osc.connect(gain)
        gain.connect(this.masterGain)
        osc.start(now)
        osc.stop(now + pulses * pulseLength * 1.6 + 0.1)
    }

    // One bird call: two or three quick descending sweeps
    playBird(_loudness)
    {
        const ctx = this.context
        const now = ctx.currentTime

        const notes = 2 + Math.floor(Math.random() * 2)
        const baseFrequency = 2600 + Math.random() * 1200

        for(let i = 0; i < notes; i++)
        {
            const start = now + i * 0.16

            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(baseFrequency + Math.random() * 400, start)
            osc.frequency.exponentialRampToValueAtTime(baseFrequency * 0.65, start + 0.11)

            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0, start)
            gain.gain.linearRampToValueAtTime(0.01 * _loudness, start + 0.02)
            gain.gain.linearRampToValueAtTime(0, start + 0.13)

            osc.connect(gain)
            gain.connect(this.masterGain)
            osc.start(start)
            osc.stop(start + 0.16)
        }
    }

    update()
    {
        if(!this.started)
        {
            return
        }

        const delta = Math.min(this.time.delta, 60)
        const nightFactor = this.dayNightCycle ? this.dayNightCycle.nightFactor : 0
        const rainValue = this.weather ? this.weather.values.rain : 0
        const fogValue = this.weather ? this.weather.values.fog : 0
        const isSnow = this.weather && this.weather.getPrecipitationType() === 'snow'

        const master = this.settings.enabled ? this.settings.masterVolume : 0

        // Smoothly approach targets (manual lerp keeps it simple and click-free)
        const ease = 1 - Math.pow(0.001, delta / 1000)

        const masterTarget = master
        this.masterGain.gain.value += (masterTarget - this.masterGain.gain.value) * ease

        // Rain patter (snow is silent, it gets wind instead)
        const rainTarget = isSnow ? 0 : rainValue * 0.14
        this.rainGain.gain.value += (rainTarget - this.rainGain.gain.value) * ease

        // Wind for fog and for snowfall
        const windTarget = Math.max(fogValue * 0.07, (isSnow ? rainValue * 0.06 : 0))
        this.windGain.gain.value += (windTarget - this.windGain.gain.value) * ease

        if(master <= 0.01)
        {
            return
        }

        // Crickets: true night only (silent through sunrise/sunset transitions),
        // not raining, not foggy
        const trueNight = Math.max((nightFactor - 0.7) / 0.3, 0)
        const cricketLoudness = trueNight * (1 - rainValue) * (1 - fogValue * 0.8)
        if(cricketLoudness > 0.15)
        {
            this.nextCricketIn -= delta
            if(this.nextCricketIn <= 0)
            {
                this.playCricket(cricketLoudness)
                this.nextCricketIn = 900 + Math.random() * 2400
            }
        }

        // Birds: day, calm weather
        const birdLoudness = (1 - nightFactor) * (1 - rainValue) * (1 - fogValue * 0.8)
        if(birdLoudness > 0.15)
        {
            this.nextBirdIn -= delta
            if(this.nextBirdIn <= 0)
            {
                this.playBird(birdLoudness)
                this.nextBirdIn = 10000 + Math.random() * 15000
            }
        }
    }
}
