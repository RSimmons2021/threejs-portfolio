export default class ExperienceHUD
{
    constructor(_options)
    {
        this.config = _options.config
        this.time = _options.time
        this.physics = _options.physics
        this.dayNightCycle = _options.dayNightCycle
        this.isMobile = this.detectMobile()

        this.updateInterval = 120
        this.lastUpdateAt = 0
        this.lastScoreboardCollision = false
        this.speedDisplay = {
            currentMph: 0,
            normalMaxMph: 10,
            boostMaxMph: 30,
            normalRefSpeed: 0.01,
            boostRefSpeed: 0.02
        }

        this.setElements()
        this.applyDeviceClass()
        this.updateInstructionText()

        window.addEventListener('resize', () =>
        {
            const nextIsMobile = this.detectMobile()
            if(nextIsMobile !== this.isMobile)
            {
                this.isMobile = nextIsMobile
                this.applyDeviceClass()
                this.updateInstructionText()
            }
        })

        this.time.on('tick', () =>
        {
            this.update()
        })
    }

    detectMobile()
    {
        const touchLayout = window.matchMedia('(max-width: 768px), (hover: none) and (pointer: coarse)').matches
        const usingTouchControls = Boolean(this.config && this.config.touch)
        return touchLayout || usingTouchControls
    }

    setElements()
    {
        this.$container = document.createElement('div')
        this.$container.className = 'experience-hud'
        this.$container.innerHTML = `
            <div class="experience-hud__row">
                <div class="experience-hud__pill">
                    <span class="experience-hud__label">Cycle</span>
                    <span class="experience-hud__value js-hud-cycle">Day</span>
                </div>
                <div class="experience-hud__pill">
                    <span class="experience-hud__label">Speed</span>
                    <span class="experience-hud__value js-hud-speed">0 mph</span>
                </div>
            </div>
            <div class="experience-hud__row experience-hud__row--secondary">
                <div class="experience-hud__tip js-hud-tip-controls"></div>
                <div class="experience-hud__tip js-hud-tip-goal">Goal: bowl a strike to unlock the resume download</div>
            </div>
        `

        document.body.appendChild(this.$container)

        this.$cycle = this.$container.querySelector('.js-hud-cycle')
        this.$speed = this.$container.querySelector('.js-hud-speed')
        this.$controlsTip = this.$container.querySelector('.js-hud-tip-controls')
    }

    applyDeviceClass()
    {
        this.$container.classList.toggle('is-mobile', this.isMobile)
    }

    updateInstructionText()
    {
        if(!this.$controlsTip)
        {
            return
        }

        if(this.isMobile)
        {
            this.$controlsTip.textContent = 'Mobile: use left joystick + right pedals. Tap prompts to interact.'
        }
        else
        {
            this.$controlsTip.textContent = 'WASD / Arrows drive, Shift boosts, H horns, R resets'
        }
    }

    shouldAvoidScoreboards()
    {
        const bowling = document.querySelector('.bowling-scoreboard')
        const fieldGoal = document.querySelector('.fieldgoal-scoreboard')

        const isVisible = (_element) =>
        {
            if(!_element)
            {
                return false
            }
            return _element.style.display !== 'none' && _element.style.opacity !== '0'
        }

        return isVisible(bowling) || isVisible(fieldGoal)
    }

    update()
    {
        if(this.time.elapsed - this.lastUpdateAt < this.updateInterval)
        {
            return
        }
        this.lastUpdateAt = this.time.elapsed

        const shouldAvoid = this.shouldAvoidScoreboards()
        if(shouldAvoid !== this.lastScoreboardCollision)
        {
            this.lastScoreboardCollision = shouldAvoid
            this.$container.classList.toggle('is-avoid-scoreboards', shouldAvoid)
        }

        if(this.dayNightCycle)
        {
            const t = this.dayNightCycle.settings.currentTime
            let label = 'Day'
            if(t < 0.15 || t > 0.9) label = 'Night'
            else if(t < 0.35) label = 'Sunrise'
            else if(t > 0.65) label = 'Sunset'
            this.$cycle.textContent = label
        }

        if(this.physics && this.physics.car)
        {
            const carSpeed = Math.abs(this.physics.car.speed)
            const controls = this.physics.controls?.actions
            const isBoosting = Boolean(controls?.boost)
            const options = this.physics.car.options || {}

            const normalRefSpeed = options.controlsAcceleratinMaxSpeed || this.speedDisplay.normalRefSpeed
            const boostRefSpeed = options.controlsAcceleratinMaxSpeedBoost || this.speedDisplay.boostRefSpeed
            const referenceSpeed = Math.max(isBoosting ? boostRefSpeed : normalRefSpeed, 0.0001)

            let normalizedSpeed = Math.min(carSpeed / referenceSpeed, 1)
            normalizedSpeed = Math.pow(normalizedSpeed, 0.72) // Better low-speed variation

            const maxMph = isBoosting ? this.speedDisplay.boostMaxMph : this.speedDisplay.normalMaxMph
            const targetMph = carSpeed < 0.0005 ? 0 : normalizedSpeed * maxMph
            const smoothing = isBoosting ? 0.35 : 0.22
            this.speedDisplay.currentMph += (targetMph - this.speedDisplay.currentMph) * smoothing

            const mph = Math.round(this.speedDisplay.currentMph)
            this.$speed.textContent = `${mph} mph`
        }
    }
}
