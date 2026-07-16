/**
 * Corner minimap: section markers plus a live car arrow, drawn on a small
 * 2D canvas at ~10Hz. Hidden on touch devices (the joystick lives there).
 */
export default class Minimap
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.config = _options.config
        this.physics = _options.physics

        // The joystick occupies the bottom-left corner on touch devices
        if(this.config && this.config.touch)
        {
            return
        }

        // World bounds covering every section (world units)
        this.bounds = { minX: - 58, maxX: 88, minY: - 68, maxY: 16 }

        this.sections = [
            { x: 0, y: 0, label: 'Start' },
            { x: 54, y: - 30, label: 'Projects' },
            { x: 1.2, y: - 55, label: 'About' },
            { x: - 38, y: - 34, label: 'Play' }
        ]

        this.updateInterval = 100
        this.lastUpdateAt = 0

        this.setElement()

        // Time tick
        this.time.on('tick', () =>
        {
            if(this.time.elapsed - this.lastUpdateAt < this.updateInterval)
            {
                return
            }
            this.lastUpdateAt = this.time.elapsed
            this.draw()
        })
    }

    setElement()
    {
        this.$container = document.createElement('div')
        this.$container.className = 'minimap'

        const worldWidth = this.bounds.maxX - this.bounds.minX
        const worldHeight = this.bounds.maxY - this.bounds.minY

        this.width = 168
        this.height = Math.round(this.width * (worldHeight / worldWidth))

        this.canvas = document.createElement('canvas')
        this.canvas.width = this.width * 2 // crisp on retina
        this.canvas.height = this.height * 2
        this.canvas.style.width = `${this.width}px`
        this.canvas.style.height = `${this.height}px`

        this.context = this.canvas.getContext('2d')
        this.context.scale(2, 2)

        this.$container.appendChild(this.canvas)
        document.body.appendChild(this.$container)
    }

    worldToMap(_x, _y)
    {
        const nx = (_x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX)
        const ny = (_y - this.bounds.minY) / (this.bounds.maxY - this.bounds.minY)
        return {
            x: nx * this.width,
            y: (1 - ny) * this.height // world +y is up, canvas +y is down
        }
    }

    draw()
    {
        const ctx = this.context
        ctx.clearRect(0, 0, this.width, this.height)

        // Section markers
        ctx.font = '700 9px Amulya, sans-serif'
        ctx.textAlign = 'center'

        for(const section of this.sections)
        {
            const point = this.worldToMap(section.x, section.y)

            ctx.fillStyle = 'rgba(142, 212, 255, 0.85)'
            ctx.beginPath()
            ctx.arc(point.x, point.y, 3, 0, Math.PI * 2)
            ctx.fill()

            ctx.fillStyle = 'rgba(211, 236, 255, 0.75)'
            ctx.fillText(section.label, point.x, point.y - 6)
        }

        // Car arrow
        const car = this.physics && this.physics.car
        const chassisBody = car && car.chassis ? car.chassis.body : null
        if(chassisBody)
        {
            const point = this.worldToMap(chassisBody.position.x, chassisBody.position.y)
            const angle = car.angle || 0

            ctx.save()
            ctx.translate(point.x, point.y)
            // World angle 0 points +x (map right); canvas rotation is clockwise
            ctx.rotate(- angle)
            ctx.fillStyle = '#f2fbff'
            ctx.beginPath()
            ctx.moveTo(5.5, 0)
            ctx.lineTo(- 3.5, 3.2)
            ctx.lineTo(- 3.5, - 3.2)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
        }
    }
}
