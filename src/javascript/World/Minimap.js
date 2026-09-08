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
        this.bounds = { minX: - 58, maxX: 170, minY: - 68, maxY: 24 }

        this.sections = [
            { x: 0, y: 0, label: 'Start' },
            { x: 90, y: - 30, label: 'Projects 01–06' },
            { x: 1.2, y: - 55, label: 'About' },
            { x: - 38, y: - 34, label: 'Play' }
        ]

        // Populated by CareerRPG. Doors always show; the Site Map upgrade adds
        // the ones still locked, so buying it genuinely reveals something.
        this.doors = []
        this.people = []

        // The avenues the city is actually laid out on, so the map reads as a
        // street plan rather than four dots floating in a void.
        this.roads = [
            [0, 16, 0, -68], [-9, 14, -9, -60], [9, 14, 9, -60],
            [-58, -26, 20, -26], [-58, -38, 170, -38], [-58, -52, 20, -52],
            [-38, -20, -38, -60], [20, -14, 170, -14]
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

        this.width = 196
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

        // Street plan underneath everything
        ctx.strokeStyle = 'rgba(150, 178, 205, 0.22)'
        ctx.lineWidth = 2.5
        ctx.lineCap = 'round'
        for(const [ax, ay, bx, by] of this.roads)
        {
            const a = this.worldToMap(ax, ay)
            const b = this.worldToMap(bx, by)
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
        }

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

        // People you can talk to
        for(const person of this.people)
        {
            const point = this.worldToMap(person.x, person.y)
            ctx.fillStyle = person.met ? 'rgba(134, 222, 215, 0.5)' : 'rgba(134, 222, 215, 0.95)'
            ctx.beginPath()
            ctx.arc(point.x, point.y, 2, 0, Math.PI * 2)
            ctx.fill()
        }

        // Career doors, coloured by the building so the map matches the street
        for(const door of this.doors)
        {
            const point = this.worldToMap(door.x, door.y)
            if(!door.open)
            {
                // Locked doors read as hollow, so "what is left" is visible at a glance.
                ctx.strokeStyle = 'rgba(141, 148, 163, 0.85)'
                ctx.lineWidth = 1.2
                ctx.strokeRect(point.x - 2.2, point.y - 2.2, 4.4, 4.4)
                continue
            }
            ctx.fillStyle = door.colour || 'rgba(255, 182, 39, 0.9)'
            ctx.fillRect(point.x - 2.2, point.y - 2.2, 4.4, 4.4)
            if(door.visited)
            {
                ctx.strokeStyle = 'rgba(20, 26, 34, 0.9)'
                ctx.lineWidth = 1
                ctx.strokeRect(point.x - 1, point.y - 1, 2, 2)
            }
        }

        // Car arrow
        const car = this.physics && this.physics.car
        const chassisBody = car && car.chassis ? car.chassis.body : null
        if(chassisBody)
        {
            const position = this.physics.getPlayerPosition?.() || chassisBody.position
            const point = this.worldToMap(position.x, position.y)
            const angle = car.angle || 0

            ctx.save()
            ctx.translate(point.x, point.y)
            // World angle 0 points +x (map right); canvas rotation is clockwise
            ctx.rotate(- angle)
            const onFoot = Boolean(this.physics.onFoot)
            ctx.fillStyle = onFoot ? '#ffb627' : '#f2fbff'
            ctx.beginPath()
            if(onFoot)
            {
                // A dot for the walker: an arrow implies a heading the walker
                // does not really have in third person.
                ctx.arc(0, 0, 3.2, 0, Math.PI * 2)
            }
            else
            {
                ctx.moveTo(5.5, 0)
                ctx.lineTo(- 3.5, 3.2)
                ctx.lineTo(- 3.5, - 3.2)
                ctx.closePath()
            }
            ctx.fill()
            ctx.strokeStyle = 'rgba(11, 16, 24, 0.9)'
            ctx.lineWidth = 1
            ctx.stroke()
            ctx.restore()
        }
    }
}
