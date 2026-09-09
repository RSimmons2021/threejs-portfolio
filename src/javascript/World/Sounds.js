import { Howl, Howler } from 'howler'
import createSoundCues, { CUE_SAMPLES } from './soundCues.js'

export default class Sounds
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.debug = _options.debug

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('sounds')
            // this.debugFolder.open()
        }

        // Set up
        this.items = []

        this.setSettings()
        this.setMasterVolume()
        this.setMute()
        this.setEngine()
        this.setCues()
        this.setBoard()
    }

    setSettings()
    {
        this.settings = [
            {
                name: 'reveal',
                sounds: ['./sounds/reveal/reveal-1.mp3'],
                minDelta: 100,
                velocityMin: 0,
                velocityMultiplier: 1,
                volumeMin: 1,
                volumeMax: 1,
                rateMin: 1,
                rateMax: 1
            },
            {
                name: 'brick',
                sounds: ['./sounds/bricks/brick-1.mp3', './sounds/bricks/brick-2.mp3', './sounds/bricks/brick-4.mp3', './sounds/bricks/brick-6.mp3', './sounds/bricks/brick-7.mp3', './sounds/bricks/brick-8.mp3'],
                minDelta: 100,
                velocityMin: 1,
                velocityMultiplier: 0.75,
                volumeMin: 0.2,
                volumeMax: 0.85,
                rateMin: 0.5,
                rateMax: 0.75
            },
            {
                name: 'bowlingPin',
                sounds: ['./sounds/bowling/pin-1.mp3'],
                minDelta: 0,
                velocityMin: 1,
                velocityMultiplier: 0.5,
                volumeMin: 0.35,
                volumeMax: 1,
                rateMin: 0.1,
                rateMax: 0.85
            },
            {
                name: 'bowlingBall',
                sounds: ['./sounds/bowling/pin-1.mp3', './sounds/bowling/pin-1.mp3', './sounds/bowling/pin-1.mp3'],
                minDelta: 0,
                velocityMin: 1,
                velocityMultiplier: 0.5,
                volumeMin: 0.35,
                volumeMax: 1,
                rateMin: 0.1,
                rateMax: 0.2
            },
            {
                name: 'carHit',
                sounds: ['./sounds/car-hits/car-hit-1.mp3', './sounds/car-hits/car-hit-3.mp3', './sounds/car-hits/car-hit-4.mp3', './sounds/car-hits/car-hit-5.mp3'],
                minDelta: 100,
                velocityMin: 2,
                velocityMultiplier: 1,
                volumeMin: 0.2,
                volumeMax: 0.6,
                rateMin: 0.35,
                rateMax: 0.55
            },
            {
                name: 'woodHit',
                sounds: ['./sounds/wood-hits/wood-hit-1.mp3'],
                minDelta: 30,
                velocityMin: 1,
                velocityMultiplier: 1,
                volumeMin: 0.5,
                volumeMax: 1,
                rateMin: 0.75,
                rateMax: 1.5
            },
            {
                name: 'uiArea',
                sounds: ['./sounds/ui/area-1.mp3'],
                minDelta: 100,
                velocityMin: 0,
                velocityMultiplier: 1,
                volumeMin: 0.75,
                volumeMax: 1,
                rateMin: 0.95,
                rateMax: 1.05
            },
            {
                name: 'carHorn1',
                sounds: ['./sounds/car-horns/car-horn-1.mp3'],
                minDelta: 0,
                velocityMin: 0,
                velocityMultiplier: 1,
                volumeMin: 0.95,
                volumeMax: 1,
                rateMin: 1,
                rateMax: 1
            },
            {
                name: 'carHorn2',
                sounds: ['./sounds/car-horns/car-horn-2.mp3'],
                minDelta: 0,
                velocityMin: 0,
                velocityMultiplier: 1,
                volumeMin: 0.95,
                volumeMax: 1,
                rateMin: 1,
                rateMax: 1
            },
            {
                name: 'horn',
                sounds: ['./sounds/horns/horn-1.mp3', './sounds/horns/horn-2.mp3', './sounds/horns/horn-3.mp3'],
                minDelta: 100,
                velocityMin: 1,
                velocityMultiplier: 0.75,
                volumeMin: 0.5,
                volumeMax: 1,
                rateMin: 0.75,
                rateMax: 1
            }
        ]

        for(const _settings of this.settings)
        {
            this.add(_settings)
        }
    }

    setMasterVolume()
    {
        // Set up
        this.masterVolume = 0.5
        Howler.volume(this.masterVolume)

        window.requestAnimationFrame(() =>
        {
            Howler.volume(this.masterVolume)
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this, 'masterVolume').step(0.001).min(0).max(1).onChange(() =>
            {
                Howler.volume(this.masterVolume)
            })
        }
    }

    setMute()
    {
        // Set up
        this.muted = typeof this.debug !== 'undefined'
        Howler.mute(this.muted)

        this.toggleMute = () =>
        {
            this.muted = !this.muted
            Howler.mute(this.muted)
        }

        // M Key
        window.addEventListener('keydown', (_event) =>
        {
            if(_event.key === 'm')
            {
                this.toggleMute()
            }
        })

        // Tab focus / blur
        document.addEventListener('visibilitychange', () =>
        {
            if(document.hidden)
            {
                Howler.mute(true)
            }
            else
            {
                Howler.mute(this.muted)
            }
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder.add(this, 'muted').listen().onChange(() =>
            {
                Howler.mute(this.muted)
            })
        }
    }

    setEngine()
    {
        // Keep the original, softer engine character: one continuous low-off
        // loop whose pitch and volume follow the car without clip switching.
        this.engine = {}
        this.engine.started = false
        this.engine.running = true
        this.engine.ready = false
        this.engine.failed = false
        this.engine.soundId = null
        this.engine.vehicleStateProvider = null

        this.engine.progress = 0
        this.engine.progressEasingUp = 0.3
        this.engine.progressEasingDown = 0.15

        this.engine.speed = 0
        this.engine.speedMultiplier = 2.5
        this.engine.acceleration = 0
        this.engine.accelerationMultiplier = 0.4

        this.engine.rate = {}
        this.engine.rate.min = 0.4
        this.engine.rate.max = 1.4

        this.engine.volume = {}
        this.engine.volume.min = 0.4
        this.engine.volume.max = 1
        this.engine.volume.master = 0

        this.engine.sound = new Howl({
            // One steady loop, pitch-shifted across the rev range by rate below.
            src: ['./sounds/engines/1/engine-loop.mp3'],
            loop: true,
            onload: () =>
            {
                this.engine.ready = true
                if(!this.engine.started || this.engine.soundId !== null)
                {
                    return
                }

                this.engine.soundId = this.engine.sound.play()
                this.updateEngineSound()
            },
            onloaderror: (_id, _error) =>
            {
                this.engine.failed = true
                console.warn('Engine audio could not be loaded.', _error)
            },
            onplayerror: (_id, _error) =>
            {
                this.engine.failed = true
                console.warn('Engine audio could not be started.', _error)
            }
        })


        this.setVehicleNoise()

        // Time tick
        this.time.on('tick', () =>
        {
            // Ease the world duck so stepping indoors or opening a dialog is a
            // fade, not a cut.
            this.duck.value += (this.duck.target - this.duck.value) * 0.12
            if(this.cueGain) this.cueGain.gain.value = 0.35 + this.duck.value * 0.65
            this.updateBoardAudio()

            if(this.engine.started)
            {
                this.updateVehicleAudio()
            }

            if(!this.engine.ready || this.engine.failed)
            {
                return
            }

            let progress = Math.abs(this.engine.speed) * this.engine.speedMultiplier + Math.max(this.engine.acceleration, 0) * this.engine.accelerationMultiplier
            progress = Math.min(Math.max(progress, 0), 1)

            this.engine.progress += (progress - this.engine.progress) * this.engine[progress > this.engine.progress ? 'progressEasingUp' : 'progressEasingDown']
            this.updateEngineSound()
        })

        // Debug
        if(this.debug)
        {
            const folder = this.debugFolder.addFolder('engine')
            folder.open()

            folder.add(this.engine, 'progressEasingUp').step(0.001).min(0).max(1).name('progressEasingUp')
            folder.add(this.engine, 'progressEasingDown').step(0.001).min(0).max(1).name('progressEasingDown')
            folder.add(this.engine.rate, 'min').step(0.001).min(0).max(4).name('rateMin')
            folder.add(this.engine.rate, 'max').step(0.001).min(0).max(4).name('rateMax')
            folder.add(this.engine, 'speedMultiplier').step(0.01).min(0).max(5).name('speedMultiplier')
            folder.add(this.engine, 'accelerationMultiplier').step(0.01).min(0).max(100).name('accelerationMultiplier')
            folder.add(this.engine, 'progress').step(0.01).min(0).max(1).name('progress').listen()
        }
    }

    startEngine()
    {
        if(this.engine.started || this.engine.failed)
        {
            return
        }

        this.engine.started = true

        if(this.engine.sound.state() === 'loaded')
        {
            this.engine.ready = true
            this.engine.soundId = this.engine.sound.play()
            this.updateEngineSound()
            return
        }

        this.engine.sound.load()
    }


    setVehicleStateProvider(_provider)
    {
        this.engine.vehicleStateProvider = typeof _provider === 'function' ? _provider : null
    }

    updateEngineSound()
    {
        if(!this.engine.ready || this.engine.soundId === null)
        {
            return
        }

        const rateAmplitude = this.engine.rate.max - this.engine.rate.min
        const nextRate = this.engine.rate.min + rateAmplitude * this.engine.progress
        const volumeAmplitude = this.engine.volume.max - this.engine.volume.min
        const nextVolume = (this.engine.volume.min + volumeAmplitude * this.engine.progress) * this.engine.volume.master

        this.engine.sound.rate(nextRate, this.engine.soundId)
        this.engine.sound.volume(nextVolume, this.engine.soundId)
    }

    setVehicleNoise()
    {
        const context = Howler.ctx
        const destination = Howler.masterGain
        this.engine.noise = { ready: false }

        if(!context || !destination)
        {
            return
        }

        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < data.length; i++)
        {
            data[i] = Math.random() * 2 - 1
        }

        const createNoiseLayer = (_type, _frequency, _q = 0.8) =>
        {
            const source = context.createBufferSource()
            source.buffer = buffer
            source.loop = true
            const filter = context.createBiquadFilter()
            filter.type = _type
            filter.frequency.value = _frequency
            filter.Q.value = _q
            const gain = context.createGain()
            gain.gain.value = 0
            source.connect(filter)
            filter.connect(gain)
            gain.connect(destination)
            source.start()
            return { source, filter, gain, value: 0 }
        }

        this.engine.noise.wind = createNoiseLayer('bandpass', 720, 0.65)
        this.engine.noise.brake = createNoiseLayer('highpass', 1550, 0.9)
        this.engine.noise.ready = true
    }

    updateVehicleAudio()
    {
        const state = this.engine.vehicleStateProvider ? this.engine.vehicleStateProvider() : null
        const speed = Math.min(Math.max(state?.speed ?? this.engine.progress, 0), 1)
        const braking = Math.min(Math.max(state?.braking ?? 0, 0), 1)
        const cornering = Math.min(Math.max(state?.cornering ?? 0, 0), 1)


        if(this.engine.noise.ready)
        {
            const windTarget = speed * speed * 0.035 * this.engine.volume.master * this.duck.value
            const brakeTarget = braking * speed * 0.018 * this.engine.volume.master * this.duck.value
            this.engine.noise.wind.value += (windTarget - this.engine.noise.wind.value) * 0.08
            this.engine.noise.brake.value += (brakeTarget - this.engine.noise.brake.value) * 0.18
            this.engine.noise.wind.gain.gain.value = this.engine.noise.wind.value
            this.engine.noise.brake.gain.gain.value = this.engine.noise.brake.value
            this.engine.noise.wind.filter.frequency.value = 480 + speed * 1100
        }
    }

    // Synthesised cues for the walking layer, plus the ducking bus that lets
    // the world drop back when a dialog opens or you step indoors.
    setCues()
    {
        this.cues = null
        this.duck = { target: 1, value: 1, gain: null }

        const context = Howler.ctx
        if(!context || !Howler.masterGain) return

        // Cues sit behind their own gain so a dialog can duck the world
        // without muting the thing the visitor just did.
        this.cueGain = context.createGain()
        this.cueGain.gain.value = 1
        this.cueGain.connect(Howler.masterGain)

        // Load the generated cue samples. Each is a plain one-shot: no velocity
        // scaling, no rate variation — these carry meaning, so they should sound
        // the same every time rather than being randomised like an impact.
        this.cueSamples = {}
        for(const [name, file] of Object.entries(CUE_SAMPLES))
        {
            const sound = new Howl({ src: [`./sounds/${file}`], volume: 0.55, preload: true })
            this.cueSamples[name] = sound
        }

        // Cues prefer their sample and fall back to synthesis until it loads,
        // so the walking layer is never silent mid-download or if a file is
        // missing entirely.
        this.cues = createSoundCues(context, this.cueGain, (_name) =>
        {
            const sound = this.cueSamples[_name]
            if(!sound || sound.state() !== 'loaded') return false
            sound.volume(0.55 * this.duck.value)
            sound.play()
            return true
        })
    }

    // amount 0 = full world, 1 = fully ducked. Used indoors and behind dialogs.
    setWorldDuck(_amount)
    {
        this.duck.target = 1 - Math.min(Math.max(_amount, 0), 1)
    }

    play(_name, _velocity)
    {
        // Kept for callers that reach for a cue by name.
        if(this.cues && typeof this.cues[_name] === 'function' && !this.muted)
        {
            this.cues[_name]()
            return
        }
        return this.playItem(_name, _velocity)
    }

    // Rolling board noise from the generated loop, with volume and pitch tied
    // to real speed so kerbs and corners are audible rather than a flat drone.
    setBoard()
    {
        this.board = { speed: 0, value: 0, ready: false, soundId: null }

        this.board.sound = new Howl({
            src: ['./sounds/cues/board-roll.mp3'],
            loop: true,
            volume: 0,
            onload: () => { this.board.ready = true },
            onloaderror: () => { console.warn('Board audio could not be loaded.') }
        })
    }

    updateBoardAudio()
    {
        if(!this.board.ready) return

        const speed = Math.min(Math.max(this.board.speed, 0), 1)
        // Ease so a dropped frame or a kerb does not chop the roll into pieces.
        this.board.value += (speed - this.board.value) * 0.2

        // Below a whisper the loop is stopped outright: a board standing still
        // should be silent, not a quiet drone.
        if(this.board.value < 0.01)
        {
            if(this.board.soundId !== null)
            {
                this.board.sound.stop(this.board.soundId)
                this.board.soundId = null
            }
            return
        }

        if(this.board.soundId === null) this.board.soundId = this.board.sound.play()
        this.board.sound.volume(this.board.value * 0.5 * this.duck.value, this.board.soundId)
        this.board.sound.rate(0.82 + this.board.value * 0.5, this.board.soundId)
    }

    // The car is a physical object: when nobody is in it, it is switched off.
    // Ducking the engine to zero left a silent loop running and the tyre layer
    // live, which is not the same thing as an engine that has stopped.
    setEngineRunning(_running)
    {
        const running = Boolean(_running)
        if(running === this.engine.running) return
        this.engine.running = running

        if(this.engine.ready && this.engine.soundId !== null)
        {
            if(running) this.engine.sound.play(this.engine.soundId)
            else this.engine.sound.pause(this.engine.soundId)
        }

    }

    playInterfaceTone(_preset = 'focus')
    {
        const context = Howler.ctx
        const destination = Howler.masterGain
        if(!context || !destination || this.muted)
        {
            return
        }

        const frequencies = {
            focus: [220, 330],
            reset: [196, 294],
            sleep: [130.81, 196]
        }
        const notes = frequencies[_preset] || frequencies.focus
        const now = context.currentTime

        notes.forEach((_frequency, _index) =>
        {
            const oscillator = context.createOscillator()
            const gain = context.createGain()
            oscillator.type = _index === 0 ? 'sine' : 'triangle'
            oscillator.frequency.value = _frequency
            gain.gain.setValueAtTime(0, now)
            gain.gain.linearRampToValueAtTime(0.035 / (_index + 1), now + 0.04)
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72)
            oscillator.connect(gain)
            gain.connect(destination)
            oscillator.start(now)
            oscillator.stop(now + 0.75)
        })
    }

    add(_options)
    {
        const item = {
            name: _options.name,
            minDelta: _options.minDelta,
            velocityMin: _options.velocityMin,
            velocityMultiplier: _options.velocityMultiplier,
            volumeMin: _options.volumeMin,
            volumeMax: _options.volumeMax,
            rateMin: _options.rateMin,
            rateMax: _options.rateMax,
            lastTime: 0,
            sounds: []
        }

        for(const _sound of _options.sounds)
        {
            const sound = new Howl({
                src: [_sound],
                onloaderror: (_id, _error) =>
                {
                    console.warn(`Sound could not be loaded: ${_sound}`, _error)
                }
            })

            item.sounds.push(sound)
        }

        this.items.push(item)
    }

    // Sample-based player. play() dispatches synthesised cues first and falls
    // through to here for anything backed by an audio file.
    playItem(_name, _velocity)
    {
        const item = this.items.find((_item) => _item.name === _name)
        const time = Date.now()
        const velocity = typeof _velocity === 'undefined' ? 0 : _velocity

        if(item && time > item.lastTime + item.minDelta && (item.velocityMin === 0 || velocity > item.velocityMin))
        {
            // Find random sound
            const sound = item.sounds[Math.floor(Math.random() * item.sounds.length)]

            // Update volume
            let volume = Math.min(Math.max((velocity - item.velocityMin) * item.velocityMultiplier, item.volumeMin), item.volumeMax)
            volume = Math.pow(volume, 2)
            sound.volume(volume)

            // Update rate
            const rateAmplitude = item.rateMax - item.rateMin
            sound.rate(item.rateMin + Math.random() * rateAmplitude)

            // Play
            sound.play()

            // Save last play time
            item.lastTime = time
        }
    }

    suspend()
    {
        Howler.mute(true)
    }

    resume()
    {
        Howler.mute(this.muted)
    }

    dispose()
    {
        for(const item of this.items)
        {
            for(const sound of item.sounds)
            {
                sound.unload()
            }
        }

        this.engine.sound.unload()

        if(this.engine.noise.ready)
        {
            this.engine.noise.wind.source.stop()
            this.engine.noise.brake.source.stop()
        }
    }
}
