import * as THREE from 'three'
import projects from './Sections/projectCatalog.js'

// Live dashboard on the hover car's 'nd_dash' screen (first person in the car):
// speed, autopilot/mode, altitude, a working minimap (the HUD radar drawn into
// the dash) and the next stop (guided-tour target or the nearest project).
// Layout follows static/models/cyber/textures/dash_mock.png.
const W = 1024, H = 160
const PROJECT_X = projects.map((_, i) => 30 + i * 24)

export default class CockpitDash
{
    constructor(world)
    {
        this.world = world
        this.canvas = document.createElement('canvas')
        this.canvas.width = W
        this.canvas.height = H
        this.ctx = this.canvas.getContext('2d')
        this.texture = new THREE.CanvasTexture(this.canvas)
        this.texture.colorSpace = THREE.SRGBColorSpace
        this.texture.flipY = false
        // Reuse the placeholder the car's 'nd_dash' faces already point at.
        this.material = world.materials.cyber.dashMaterial || new THREE.MeshBasicMaterial({ toneMapped: false })
        this.material.map = this.texture
        this.material.color.set('#ffffff')
        this.material.needsUpdate = true
        this.last = -Infinity
        this.draw()
        world.time.on('tick', () =>
        {
            const e = world.explorer
            if(!e?.firstPerson || e.active) return
            if(world.time.elapsed - this.last < 66) return
            this.last = world.time.elapsed
            this.draw()
        })
    }

    nextStop()
    {
        const w = this.world
        const p = w.physics.car.chassis.body.position
        let best = null
        PROJECT_X.forEach((x, i) =>
        {
            const d = Math.hypot(x - p.x, -30 - p.y)
            if(!best || d < best.d) best = { d, x, y: -30, name: projects[i].name }
        })
        return best
    }

    draw()
    {
        const w = this.world, c = this.ctx
        const car = w.physics?.car
        // Same number as the HUD speed readout (one source of truth).
        const speed = w.experienceHUD?.speedDisplay?.currentMph ?? (car ? Math.abs(car.speed) * 1000 * 2.237 : 0)
        const flying = car?.hover?.airborne
        const altitude = car?.hover?.altitude ?? 0
        c.fillStyle = '#05080b'; c.fillRect(0, 0, W, H)
        c.fillStyle = '#7a5a35'; c.fillRect(6, 6, W - 12, 3); c.fillRect(6, H - 9, W - 12, 3)
        const mono = '"JetBrains Mono", "Noto Sans Mono", monospace'
        c.textBaseline = 'alphabetic'
        c.fillStyle = '#8a96a0'; c.font = `500 18px ${mono}`; c.fillText('AUTOPILOT', 40, 40)
        const tour = !!w.camera.targetOverride
        c.fillStyle = tour ? '#ffb02e' : '#22e5ff'; c.font = `700 22px ${mono}`; c.fillText(tour ? 'ASSISTED' : 'MANUAL', 40, 68)
        c.fillStyle = '#f2f6ff'; c.font = `700 84px ${mono}`; c.fillText(String(Math.round(speed)).padStart(3, ' '), 26, 146)
        c.fillStyle = '#8a96a0'; c.font = `500 18px ${mono}`; c.fillText('mph', 214, 142)

        c.font = `500 19px ${mono}`
        c.fillStyle = '#22e5ff'; c.fillText(`MODE  ${flying ? 'FLIGHT' : 'DRIVE'}`, 290, 46)
        c.fillStyle = '#f2f6ff'; c.fillText(`ALT   ${flying ? Math.round(altitude) : 0} m`, 290, 76)
        c.fillText(`LANE  ${flying ? Math.max(1, Math.round(altitude / 15)) : '-'}`, 290, 106)
        c.fillStyle = '#ff2bd6'; c.fillText(`BOOST ${w.controls?.actions?.boost ? 'ON' : 'RDY'}`, 290, 136)

        // Minimap: the same radar the HUD draws, clipped into a circle.
        const mm = w.minimap?.canvas
        c.save(); c.beginPath(); c.arc(512, 80, 70, 0, Math.PI * 2); c.closePath()
        c.fillStyle = '#0b1a22'; c.fill(); c.clip()
        if(mm) c.drawImage(mm, 442, 10, 140, 140)
        c.restore()
        c.strokeStyle = '#1f5a5c'; c.lineWidth = 3; c.beginPath(); c.arc(512, 80, 71, 0, Math.PI * 2); c.stroke()

        const stop = car ? this.nextStop() : null
        c.fillStyle = '#8a96a0'; c.font = `500 15px ${mono}`; c.fillText('NEXT STOP', 700, 40)
        if(stop)
        {
            const p = car.chassis.body.position
            const bearing = Math.atan2(stop.y - p.y, stop.x - p.x) - car.angle
            const rel = Math.atan2(Math.sin(bearing), Math.cos(bearing))
            c.save(); c.translate(735, 100); c.rotate(-rel); c.fillStyle = '#f2f6ff'
            c.beginPath(); c.moveTo(0, -30); c.lineTo(20, 4); c.lineTo(7, 4); c.lineTo(7, 28); c.lineTo(-7, 28); c.lineTo(-7, 4); c.lineTo(-20, 4); c.closePath(); c.fill()
            c.restore()
            c.fillStyle = '#f2f6ff'; c.font = `700 30px ${mono}`; c.fillText(`${Math.round(stop.d)} m`, 790, 88)
            c.fillStyle = '#8a96a0'; c.font = `500 16px ${mono}`; c.fillText(`PROJECT AVE · ${stop.name.toUpperCase()}`.slice(0, 30), 790, 118)
        }
        this.texture.needsUpdate = true
    }
}
