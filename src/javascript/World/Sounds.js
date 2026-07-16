import { Howl, Howler } from 'howler'

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
                name: 'screech',
                sounds: ['./sounds/screeches/screech-1.mp3'],
                minDelta: 1000,
                velocityMin: 0,
                velocityMultiplier: 1,
                volumeMin: 0.75,
                volumeMax: 1,
                rateMin: 0.9,
                rateMax: 1.1
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
            src: ['./sounds/engines/1/low_off.mp3'],
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

        this.engine.tire = {
            ready: false,
            soundId: null,
            currentVolume: 0,
            spriteName: 'squeal'
        }
        this.engine.tire.sound = new Howl({
            src: ['./sounds/screeches/screech-1.mp3'],
            volume: 0,
            // The source has about 39ms of trailing silence. Loop only its
            // audible region so sustained slides do not pulse or hesitate.
            sprite: {
                squeal: [0, 272, true]
            },
            onload: () =>
            {
                this.engine.tire.ready = true
                if(this.engine.started)
                {
                    this.startTireLayer()
                }
            },
            onloaderror: (_id, _error) =>
            {
                console.warn('Tire audio could not be loaded.', _error)
            }
        })

        this.setVehicleNoise()

        // Time tick
        this.time.on('tick', () =>
        {
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

        if(this.engine.tire.sound.state() === 'loaded')
        {
            this.engine.tire.ready = true
            this.startTireLayer()
        }
        else
        {
            this.engine.tire.sound.load()
        }

        if(this.engine.sound.state() === 'loaded')
        {
            this.engine.ready = true
            this.engine.soundId = this.engine.sound.play()
            this.updateEngineSound()
            return
        }

        this.engine.sound.load()
    }

    startTireLayer()
    {
        const tire = this.engine.tire
        if(!tire.ready || tire.soundId !== null)
        {
            return
        }

        tire.soundId = tire.sound.play(tire.spriteName)
        tire.sound.volume(0, tire.soundId)
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

        const tire = this.engine.tire
        if(tire.soundId !== null)
        {
            // Steering and lateral slip must stay silent. The squeal is now a
            // braking-only cue, with a low-speed dead zone to prevent chirps.
            const brakingSpeed = Math.max((speed - 0.12) / 0.88, 0)
            const tireTarget = braking * brakingSpeed * 0.12 * this.engine.volume.master
            const response = tireTarget > tire.currentVolume ? 0.62 : 0.36
            tire.currentVolume += (tireTarget - tire.currentVolume) * response
            tire.sound.volume(tire.currentVolume, tire.soundId)
            tire.sound.rate(0.88 + speed * 0.24, tire.soundId)
        }

        if(this.engine.noise.ready)
        {
            const windTarget = speed * speed * 0.035 * this.engine.volume.master
            const brakeTarget = braking * speed * 0.018 * this.engine.volume.master
            this.engine.noise.wind.value += (windTarget - this.engine.noise.wind.value) * 0.08
            this.engine.noise.brake.value += (brakeTarget - this.engine.noise.brake.value) * 0.18
            this.engine.noise.wind.gain.gain.value = this.engine.noise.wind.value
            this.engine.noise.brake.gain.gain.value = this.engine.noise.brake.value
            this.engine.noise.wind.filter.frequency.value = 480 + speed * 1100
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

    play(_name, _velocity)
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
        this.engine.tire.sound.unload()

        if(this.engine.noise.ready)
        {
            this.engine.noise.wind.source.stop()
            this.engine.noise.brake.source.stop()
        }
    }
}
