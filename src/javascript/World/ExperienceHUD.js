export default class ExperienceHUD
{
    constructor(_options)
    {
        this.config = _options.config
        this.time = _options.time
        this.physics = _options.physics
        this.sounds = _options.sounds
        this.isMobile = this.detectMobile()

        this.updateInterval = 120
        this.lastUpdateAt = 0
        this.lastScoreboardCollision = false

        // Contextual tips state
        this.drivingTime = 0
        this.controlsTipHidden = false
        this.goalTipVisible = false
        this.playgroundCenter = { x: - 38, y: - 34 }
        this.playgroundRadius = 30

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
                this.updateMobileScoreboardClearance(this.lastScoreboardCollision)
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
        this.$container.style.setProperty('--hud-mobile-avoid-top', '74px')
        this.$container.innerHTML = `
            <div class="experience-hud__row">
                <div class="experience-hud__pill">
                    <span class="experience-hud__label">Speed</span>
                    <span class="experience-hud__value js-hud-speed">0 mph</span>
                </div>
                <button type="button" class="experience-hud__button js-hud-mute" aria-label="Toggle sound (M)" title="Toggle sound (M)">🔊</button>
            </div>
            <div class="experience-hud__row experience-hud__row--secondary">
                <div class="experience-hud__tip js-hud-tip-controls"></div>
                <div class="experience-hud__tip js-hud-tip-goal is-hidden">Free play: race your ghost or bowl three frames at the arcade</div>
            </div>
        `

        document.body.appendChild(this.$container)

        this.$speed = this.$container.querySelector('.js-hud-speed')
        this.$controlsTip = this.$container.querySelector('.js-hud-tip-controls')
        this.$goalTip = this.$container.querySelector('.js-hud-tip-goal')
        this.$muteButton = this.$container.querySelector('.js-hud-mute')

        this.$muteButton.addEventListener('click', () =>
        {
            if(this.sounds)
            {
                this.sounds.toggleMute()
                this.updateMuteButton()
            }
        })

        this.updateMuteButton()
    }

    updateMuteButton()
    {
        if(!this.sounds || !this.$muteButton)
        {
            return
        }

        this.$muteButton.textContent = this.sounds.muted ? '🔇' : '🔊'
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

    updateMobileScoreboardClearance(_shouldAvoid)
    {
        if(!this.isMobile || !_shouldAvoid)
        {
            this.$container.style.removeProperty('--hud-mobile-avoid-top')
            return
        }

        const scoreboards = [
            document.querySelector('.bowling-scoreboard'),
            document.querySelector('.fieldgoal-scoreboard')
        ]

        const visibleScoreboards = scoreboards.filter((_element) =>
        {
            if(!_element)
            {
                return false
            }

            return _element.style.display !== 'none' && _element.style.opacity !== '0'
        })

        if(visibleScoreboards.length === 0)
        {
            this.$container.style.setProperty('--hud-mobile-avoid-top', '74px')
            return
        }

        let maxBottom = 0
        for(const scoreboard of visibleScoreboards)
        {
            const rect = scoreboard.getBoundingClientRect()
            if(rect.bottom > maxBottom)
            {
                maxBottom = rect.bottom
            }
        }

        const minTop = 74
        const maxTop = Math.max(Math.floor(window.innerHeight * 0.55), minTop)
        const nextTop = Math.min(Math.max(Math.ceil(maxBottom + 10), minTop), maxTop)

        this.$container.style.setProperty('--hud-mobile-avoid-top', `${nextTop}px`)
    }

    update()
    {
        if(this.time.elapsed - this.lastUpdateAt < this.updateInterval)
        {
            return
        }
        this.lastUpdateAt = this.time.elapsed

        const shouldAvoid = this.shouldAvoidScoreboards()
        this.updateMobileScoreboardClearance(shouldAvoid)
        if(shouldAvoid !== this.lastScoreboardCollision)
        {
            this.lastScoreboardCollision = shouldAvoid
            this.$container.classList.toggle('is-avoid-scoreboards', shouldAvoid)
        }

        // Sync the mute button (can also change via the M key)
        this.updateMuteButton()

        if(this.physics && this.physics.car)
        {
            // Contextual tips: fade the controls tip once the visitor is clearly
            // driving, and only surface the bowling goal near the playground
            const carBody = this.physics.car.chassis && this.physics.car.chassis.body
            if(!this.controlsTipHidden && Math.abs(this.physics.car.speed) > 0.003)
            {
                this.drivingTime += this.updateInterval
                if(this.drivingTime > 6000)
                {
                    this.controlsTipHidden = true
                    this.$controlsTip.classList.add('is-hidden')
                }
            }

            if(carBody && this.$goalTip)
            {
                const deltaX = carBody.position.x - this.playgroundCenter.x
                const deltaY = carBody.position.y - this.playgroundCenter.y
                const nearPlayground = (deltaX * deltaX + deltaY * deltaY) < this.playgroundRadius * this.playgroundRadius

                if(nearPlayground !== this.goalTipVisible)
                {
                    this.goalTipVisible = nearPlayground
                    this.$goalTip.classList.toggle('is-hidden', !nearPlayground)
                }
            }

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
