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

        this.tick = this.tick.bind(this)
        this.tick()
    }

    /**
     * Tick
     */
    tick()
    {
        this.ticker = window.requestAnimationFrame(this.tick)

        const current = performance.now()

        this.delta = current - this.current
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
        window.cancelAnimationFrame(this.ticker)
    }
}
