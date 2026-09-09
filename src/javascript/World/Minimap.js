/**
 * GTA-style radar.
 *
 * Three things make a radar read as a radar rather than a map: it is centred on
 * the player instead of showing the whole world, it rotates so the way you are
 * facing is always up, and blips outside its range are pinned to the rim so an
 * off-radar objective still points the way. Hidden on touch, where the joystick
 * owns this corner.
 */
const SIZE = 168            // css pixels, edge to edge
const RANGE = 46            // world units visible across the radius

export default class Minimap
{
    constructor(_options)
    {
        this.time = _options.time
        this.config = _options.config
        this.physics = _options.physics

        if(this.config && this.config.touch) return

        // Populated by CareerRPG.
        this.doors = []
        this.people = []

        // The street grid, drawn as thick strips rather than hairlines: that is
        // what makes a radar legible at a glance instead of a wiring diagram.
        this.roads = [
            [0, 16, 0, -68], [-9, 14, -9, -60], [9, 14, 9, -60],
            [-38, -20, -38, -60], [-58, -26, -58, -52],
            [-58, -26, 20, -26], [-58, -38, 170, -38], [-58, -52, 20, -52],
            [-20, -14, 20, -14], [20, -14, 170, -14], [-20, -66, 20, -66],
            [-48, -38, -48, -56], [-48, -56, -20, -56]
        ]

        this.landmarks = [
            { x: 0, y: 0, label: 'START' },
            { x: 90, y: -30, label: 'PROJECTS' },
            { x: 1.2, y: -55, label: 'ABOUT' },
            { x: -38, y: -34, label: 'PLAY' }
        ]

        // Eased: snapping the world to every steering twitch is nauseating.
        this.heading = 0

        this.updateInterval = 60
        this.lastUpdateAt = 0

        this.setElement()
        this.time.on('tick', () =>
        {
            if(this.time.elapsed - this.lastUpdateAt < this.updateInterval) return
            this.lastUpdateAt = this.time.elapsed
            this.draw()
        })
    }

    setElement()
    {
        this.$container = document.createElement('div')
        this.$container.className = 'minimap'

        this.size = SIZE
        this.radius = SIZE / 2

        this.canvas = document.createElement('canvas')
        this.canvas.width = SIZE * 2
        this.canvas.height = SIZE * 2
        this.canvas.style.width = `${SIZE}px`
        this.canvas.style.height = `${SIZE}px`

        this.context = this.canvas.getContext('2d')
        this.context.scale(2, 2)

        this.$container.appendChild(this.canvas)
        document.body.appendChild(this.$container)
    }

    get scale() { return this.radius / RANGE }

    // World point -> radar pixel, with the same rotation the map uses. Anything
    // past the rim comes back clamped to it and flagged.
    project(_x, _y, _player)
    {
        const r = this.radius
        const angle = - this.heading - Math.PI / 2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        const wx = (_x - _player.x) * this.scale
        const wy = (_y - _player.y) * this.scale
        // Canvas y grows downwards, world y grows up, hence the negation.
        const dx = wx * cos + wy * sin
        const dy = wx * sin - wy * cos

        const distance = Math.hypot(dx, dy)
        const edge = r - 9
        return distance > edge
            ? { x: r + (dx / distance) * edge, y: r + (dy / distance) * edge, clamped: true, angle: Math.atan2(dy, dx) }
            : { x: r + dx, y: r + dy, clamped: false, angle: Math.atan2(dy, dx) }
    }

    draw()
    {
        const ctx = this.context
        const r = this.radius
        const car = this.physics && this.physics.car
        if(!car || !car.chassis) return

        const player = this.physics.getPlayerPosition?.() || car.chassis.body.position
        const raw = this.physics.getPlayerHeading?.() ?? car.angle ?? 0

        // Shortest arc, so crossing north does not spin the map the long way.
        this.heading += Math.atan2(Math.sin(raw - this.heading), Math.cos(raw - this.heading)) * 0.22

        ctx.clearRect(0, 0, this.size, this.size)

        ctx.save()
        ctx.beginPath()
        ctx.arc(r, r, r - 1, 0, Math.PI * 2)
        ctx.clip()

        ctx.fillStyle = '#11151d'
        ctx.fillRect(0, 0, this.size, this.size)

        // Roads, in the rotated frame.
        ctx.save()
        ctx.translate(r, r)
        ctx.rotate(- this.heading - Math.PI / 2)
        ctx.scale(this.scale, - this.scale)
        ctx.translate(- player.x, - player.y)
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        // Dark casing under a lighter fill is what reads as a street.
        for(const pass of [{ width: 7.5, colour: '#232b38' }, { width: 4.4, colour: '#3b4759' }])
        {
            ctx.strokeStyle = pass.colour
            ctx.lineWidth = pass.width / this.scale
            ctx.beginPath()
            for(const [ax, ay, bx, by] of this.roads)
            {
                ctx.moveTo(ax, ay)
                ctx.lineTo(bx, by)
            }
            ctx.stroke()
        }
        ctx.restore()

        // Blips are placed rotated but drawn upright, so their shapes stay readable.
        for(const person of this.people)
        {
            const p = this.project(person.x, person.y, player)
            if(p.clamped) continue                       // people are not objectives
            ctx.fillStyle = person.met ? 'rgba(134,222,215,0.45)' : '#86ded7'
            ctx.beginPath()
            ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2)
            ctx.fill()
        }

        for(const door of this.doors)
        {
            const p = this.project(door.x, door.y, player)
            const colour = door.open ? (door.colour || '#ffb627') : '#8d94a3'

            if(p.clamped)
            {
                // Rim marker pointing outwards at the thing you cannot see yet.
                ctx.save()
                ctx.translate(p.x, p.y)
                ctx.rotate(p.angle)
                ctx.globalAlpha = 0.8
                ctx.fillStyle = colour
                ctx.beginPath()
                ctx.moveTo(4.5, 0)
                ctx.lineTo(-3, 3)
                ctx.lineTo(-3, -3)
                ctx.closePath()
                ctx.fill()
                ctx.restore()
                ctx.globalAlpha = 1
                continue
            }

            ctx.fillStyle = colour
            ctx.strokeStyle = 'rgba(8,11,16,0.9)'
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.roundRect(p.x - 3.4, p.y - 3.4, 6.8, 6.8, 1.8)
            ctx.fill()
            ctx.stroke()
            if(door.visited)
            {
                ctx.fillStyle = 'rgba(8,11,16,0.85)'
                ctx.beginPath()
                ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2)
                ctx.fill()
            }
        }

        ctx.font = '700 8px monospace'
        ctx.textAlign = 'center'
        for(const landmark of this.landmarks)
        {
            const p = this.project(landmark.x, landmark.y, player)
            if(p.clamped) continue
            ctx.fillStyle = 'rgba(211,236,255,0.45)'
            ctx.fillText(landmark.label, p.x, p.y - 7)
        }

        ctx.restore()

        // The player sits dead centre pointing up, because the map is what
        // turns. That inversion is the whole difference between radar and map.
        ctx.save()
        ctx.translate(r, r)
        ctx.fillStyle = this.physics.onFoot ? '#ffb627' : '#f2fbff'
        ctx.strokeStyle = 'rgba(8,11,16,0.95)'
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(0, -7.5)
        ctx.lineTo(5, 5)
        ctx.lineTo(0, 2.2)
        ctx.lineTo(-5, 5)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        ctx.restore()

        // North pip, so a rotating radar is still orientable.
        const north = - this.heading - Math.PI
        ctx.save()
        ctx.translate(r + Math.cos(north) * (r - 8), r + Math.sin(north) * (r - 8))
        ctx.fillStyle = '#c2412d'
        ctx.beginPath()
        ctx.arc(0, 0, 2.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
    }
}
