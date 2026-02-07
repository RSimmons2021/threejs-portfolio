import gsap from 'gsap'

export default class ThreejsJourney
{
    constructor(_options)
    {
        // Options
        this.config = _options.config
        this.time = _options.time
        this.world = _options.world

        // Setup
        this.$container = document.querySelector('.js-threejs-journey')
        this.$messages = [...this.$container.querySelectorAll('.js-message')]
        this.$yes = this.$container.querySelector('.js-yes')
        this.$no = this.$container.querySelector('.js-no')

        this.step = 0
        this.maxStep = this.$messages.length - 1
        this.traveledDistance = 0
        this.seenCount = Number(window.localStorage.getItem('threejsJourneySeenCount') || 0)
        this.prevent = window.localStorage.getItem('threejsJourneyPrevent') === '1'
        this.shown = this.prevent || this.config.touch
        this.minTraveledDistance = this.seenCount === 0 ? 4 : 22

        this.setYesNo()
        this.setLog()

        this.time.on('tick', () =>
        {
            if(!this.world.physics || this.shown || this.config.touch)
            {
                return
            }

            this.traveledDistance += Math.abs(this.world.physics.car.forwardSpeed)

            if(this.traveledDistance > this.minTraveledDistance)
            {
                this.start()
            }
        })
    }

    setYesNo()
    {
        // Clicks
        this.$yes.addEventListener('click', () =>
        {
            gsap.delayedCall(1.5, () =>
            {
                this.hide()
            })
            window.localStorage.setItem('threejsJourneyPrevent', 1)
        })

        this.$no.addEventListener('click', () =>
        {
            this.next()

            gsap.delayedCall(4.5, () =>
            {
                this.hide()
            })
        })

        // Hovers
        this.$yes.addEventListener('mouseenter', () =>
        {
            this.$container.classList.remove('is-hover-none')
            this.$container.classList.remove('is-hover-no')
            this.$container.classList.add('is-hover-yes')
        })

        this.$no.addEventListener('mouseenter', () =>
        {
            this.$container.classList.remove('is-hover-none')
            this.$container.classList.add('is-hover-no')
            this.$container.classList.remove('is-hover-yes')
        })

        this.$yes.addEventListener('mouseleave', () =>
        {
            this.$container.classList.add('is-hover-none')
            this.$container.classList.remove('is-hover-no')
            this.$container.classList.remove('is-hover-yes')
        })

        this.$no.addEventListener('mouseleave', () =>
        {
            this.$container.classList.add('is-hover-none')
            this.$container.classList.remove('is-hover-no')
            this.$container.classList.remove('is-hover-yes')
        })
    }

    setLog()
    {
        if(this.config.debug)
        {
            console.log('%cWelcome to Richard Simmons Portfolio', 'color: #8ED4FF; font-size: 14px; font-weight: 700;')
            console.log('%cUse WASD / Arrows to drive. Shift to boost. H to horn.', 'color: #8ED4FF')
        }
    }

    hide()
    {
        for(const $message of this.$messages)
        {
            $message.classList.remove('is-visible')
        }

        gsap.delayedCall(0.45, () =>
        {
            this.$container.classList.remove('is-active')
        })
    }

    start()
    {
        if(this.shown || this.prevent || this.config.touch)
        {
            return
        }

        this.step = 0
        this.$container.classList.add('is-active')

        window.requestAnimationFrame(() =>
        {
            this.next()
            gsap.delayedCall(3.2, () => this.next())
            gsap.delayedCall(6.4, () => this.next())
            gsap.delayedCall(9.0, () => this.next())
        })

        this.shown = true
        window.localStorage.setItem('threejsJourneySeenCount', this.seenCount + 1)
    }

    updateMessages()
    {
        let i = 0

        // Visibility
        for(const $message of this.$messages)
        {
            if(i < this.step)
            {
                $message.classList.add('is-visible')
            }
            i++
        }

        // Position
        this.$messages.reverse()

        let height = 0
        i = this.maxStep
        for(const $message of this.$messages)
        {
            const messageHeight = $message.offsetHeight
            if(i < this.step)
            {
                $message.style.transform = `translateY(${-height}px)`
                height += messageHeight + 16
            }
            else
            {
                $message.style.transform = `translateY(${messageHeight + 12}px)`
            }
            i--
        }

        this.$messages.reverse()
    }

    next()
    {
        if(this.step > this.maxStep)
        {
            return
        }

        this.step++
        this.updateMessages()
    }
}
