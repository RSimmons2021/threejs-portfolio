import EventEmitter from './EventEmitter.js'

export default class Time extends EventEmitter
{
    /**
     * Constructor
     */
    constructor()
    {
        super()

        this.start = performance.now()
        this.current = this.start
        this.elapsed = 0
        this.delta = 16
        this.running = false
        this.frameInterval = 0

        this.tick = this.tick.bind(this)
        this.resume()
    }

    /**
     * Tick
     */
    tick()
    {
        if(!this.running)
        {
            return
        }

        this.ticker = window.requestAnimationFrame(this.tick)

        const current = performance.now()
        // Medium/Low limit rendering to 60 Hz on 90/120 Hz phone panels,
        // leaving thermal headroom. Physics still consumes the actual elapsed
        // interval, and skipped RAF callbacks never enter FPS measurements.
        if(current - this.current + 0.5 < this.frameInterval) return

        this.delta = current - this.current
        this.rawDelta = this.delta
        this.elapsed = current - this.start
        this.current = current

        if(this.delta > 60)
        {
            this.delta = 60
        }

        this.trigger('tick')
    }

    /**
     * Stop
     */
    stop()
    {
        if(!this.running)
        {
            return
        }

        this.running = false
        window.cancelAnimationFrame(this.ticker)
    }

    /**
     * Resume without including the paused duration in the next frame delta.
     */
    resume()
    {
        if(this.running)
        {
            return
        }

        const current = performance.now()
        this.current = current
        this.start = current - this.elapsed
        this.running = true
        this.ticker = window.requestAnimationFrame(this.tick)
    }
}
