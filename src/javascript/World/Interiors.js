import * as THREE from 'three'
import CANNON from 'cannon'
import createInteriorMaterial from './createInteriorMaterial.js'

// Interiors are real rooms you walk into, not cards. Each one is parked far
// outside the city (nothing else is built past x = 200) and the walker is
// teleported in and out, which is cheaper and far less fragile than streaming a
// separate scene. The room is modelled in Blender:
// static/models/nyc/apartment-interior.glb
const ROOM_ORIGIN = { x: 320, y: 320 }

export default class Interiors
{
    constructor(_world)
    {
        this.world = _world
        this.container = new THREE.Group()
        this.container.name = 'Interiors'
        this.active = null
        this.returnTo = null
        this.bodies = []

        this.setRoom()
        this.setInterface()
        this.setStations()
        this.world.time.on('tick', () => this.update())
    }

    setRoom()
    {
        this.room = new THREE.Group()
        this.room.name = 'Apartment interior'
        this.room.position.set(ROOM_ORIGIN.x, ROOM_ORIGIN.y, 0)

        // The Blender room, re-materialised. The geometry was never the problem:
        // the city's cel shader is built for outdoors, discards every fragment
        // below z = 0 and takes its light from the sun and matcap rig, so indoors
        // it renders nothing at all. Flat interior materials instead.
        const lit = []
        this.world.resources.items.apartmentInterior.scene.traverse((_source) =>
        {
            if(!_source.isMesh) return
            const mesh = _source.clone()
            const warm = _source.name.includes('warm') || _source.name.includes('screen')
            mesh.material = createInteriorMaterial(_source.material.color, warm ? 0.18 : 0)
            this.room.add(mesh)
            if(warm) lit.push({ mesh, colour: _source.material.color })
        })

        // The Blender room is open on -Y so it can be modelled and read; these
        // close it up either side of a 1.6 doorway, with a lintel over the head.
        const wall = createInteriorMaterial(new THREE.Color('#d8cbb4'))
        const box = new THREE.BoxGeometry(1, 1, 1)
        const slab = (size, position, material) =>
        {
            const mesh = new THREE.Mesh(box, material)
            mesh.scale.set(...size)
            mesh.position.set(...position)
            this.room.add(mesh)
            return mesh
        }
        // The GLB's own shell does not close the room reliably, so the enclosure
        // is built here and the imported meshes provide the furniture. Slightly
        // different tones per face stand in for directional light.
        const wallSide = createInteriorMaterial(new THREE.Color('#c3b69f'))
        const wallBack = createInteriorMaterial(new THREE.Color('#b3a68f'))
        const ceiling = createInteriorMaterial(new THREE.Color('#e6dcc8'))
        slab([9.4, 0.3, 3.3], [0, 3.6, 1.65], wallBack)
        slab([0.3, 7.5, 3.3], [- 4.6, 0, 1.65], wallSide)
        slab([0.3, 7.5, 3.3], [4.6, 0, 1.65], wallSide)
        slab([9.4, 7.5, 0.25], [0, 0, 3.42], ceiling)
        slab([3.7, 0.28, 3.3], [- 2.65, - 3.5, 1.65], wall)
        slab([3.7, 0.28, 3.3], [2.65, - 3.5, 1.65], wall)
        slab([1.7, 0.28, 1.0], [0, - 3.5, 2.8], wall)
        // A closed door fills the opening. Without it the doorway is a hole
        // straight out to the city and the room reads as transparent.
        // Sits inboard of the GLB's own lit door gap so it reads as a closed
        // door from inside rather than a glowing hole.
        slab([1.66, 0.12, 2.34], [0, - 3.2, 1.17], createInteriorMaterial(new THREE.Color('#3a2c20')))
        slab([1.94, 0.09, 0.16], [0, - 3.13, 2.4], createInteriorMaterial(new THREE.Color('#16130e')))
        slab([0.16, 0.09, 2.34], [- 0.9, - 3.13, 1.17], createInteriorMaterial(new THREE.Color('#16130e')))
        slab([0.16, 0.09, 2.34], [0.9, - 3.13, 1.17], createInteriorMaterial(new THREE.Color('#16130e')))
        slab([0.13, 0.13, 0.13], [0.58, - 3.11, 1.12], createInteriorMaterial(new THREE.Color('#ffca62'), 0.3))
        // Own floor slab, proud of the world ground plane the floor shader draws.
        slab([9.2, 7.2, 0.4], [0, 0, - 0.1], createInteriorMaterial(new THREE.Color('#6b5a48')))

        this.lit = lit
        this.container.add(this.room)

        // Static walls so the walker cannot leave through the geometry.
        for(const [sx, sy, px, py] of [[9, 0.3, 0, 3.5], [3.7, 0.3, - 2.65, - 3.5], [3.7, 0.3, 2.65, - 3.5], [0.3, 7, - 4.5, 0], [0.3, 7, 4.5, 0]])
        {
            const body = new CANNON.Body({ mass: 0 })
            body.addShape(new CANNON.Box(new CANNON.Vec3(sx * 0.5, sy * 0.5, 1.8)))
            body.position.set(ROOM_ORIGIN.x + px, ROOM_ORIGIN.y + py, 1.8)
            body.collisionRole = 'interior-wall'
            this.world.physics.world.addBody(body)
            this.bodies.push(body)
        }
    }

    // Things in the room you walk up to and press E on, the same interaction the
    // street uses. Registered with CareerRPG so they share the entry prompt.
    setStations()
    {
        const rpg = this.world.careerRPG
        this.stations = [
            { id: 'bed', label: 'the bed', verb: 'Sleep in', x: 3.2, y: 1.6, run: () => this.world.careerRPG.sleep() },
            { id: 'desk', label: 'the home lab', verb: 'Sit at', x: - 2.2, y: 1.9, run: () => this.world.careerRPG.openHomeLab() },
            { id: 'door', label: 'the landing', verb: 'Step out to', x: 0, y: - 2.9, run: () => this.leave() }
        ]

        for(const station of this.stations)
        {
            const area = this.world.areas.add({
                position: new THREE.Vector2(ROOM_ORIGIN.x + station.x, ROOM_ORIGIN.y + station.y),
                halfExtents: new THREE.Vector2(1.5, 1.5)
            })
            area.on('interact', () => { if(this.active) station.run() })
            station.area = area
            rpg?.registerZone(area, station.label, station.run, station.verb)
        }
    }

    setInterface()
    {
        this.$panel = document.createElement('section')
        this.$panel.className = 'interior-bar'
        this.$panel.hidden = true
        this.$panel.innerHTML = `
            <p class="interior-bar__where" data-where></p>
            <div class="interior-bar__actions">
                <button type="button" data-interior="sleep">Sleep until morning</button>
                <button type="button" data-interior="desk">Home lab</button>
                <button type="button" data-interior="leave">Leave <kbd>Esc</kbd></button>
            </div>`
        document.body.appendChild(this.$panel)

        this.$panel.addEventListener('click', (_event) =>
        {
            const action = _event.target.closest('[data-interior]')?.dataset.interior
            if(action === 'leave') this.leave()
            if(action === 'sleep') this.world.careerRPG.sleep()
            if(action === 'desk') this.world.careerRPG.openHomeLab()
        })

        document.addEventListener('keydown', (_event) =>
        {
            if(!this.active || _event.code !== 'Escape') return
            if(document.querySelector('dialog[open]')) return
            _event.preventDefault()
            this.leave()
        }, true)
    }

    enter(_building)
    {
        const explorer = this.world.explorer
        if(this.active || !explorer) return

        // Walk in from the car if you drove up: interiors are on foot only.
        if(!explorer.active) explorer.exitCar()
        if(!explorer.active) return

        this.returnTo = { x: explorer.body.position.x, y: explorer.body.position.y, z: explorer.body.position.z }
        // Indoors is first person only: the overhead camera sits outside the
        // room looking through the ceiling, which shows nothing useful.
        this.returnToThirdPerson = !explorer.firstPerson
        if(this.returnToThirdPerson) explorer.toggleView()
        this.active = _building
        explorer.body.position.set(ROOM_ORIGIN.x, ROOM_ORIGIN.y - 2.2, 0.6)
        explorer.body.velocity.set(0, 0, 0)
        explorer.yaw = Math.PI * 0.5
        document.body.classList.add('is-indoors')
        // The street drops to a muffled bleed and the room floor lifts in.
        this.world.ambientSounds?.setEnclosure(1)
        this.world.sounds?.setWorldDuck(0.55)
        this.world.sounds?.cues?.door('home')
        this.$panel.hidden = false
        this.$panel.querySelector('[data-where]').textContent = `${_building.name} · third floor`
        this.world.careerRPG?.render()
    }

    leave()
    {
        const explorer = this.world.explorer
        if(!this.active || !explorer) return
        explorer.body.position.set(this.returnTo.x, this.returnTo.y, this.returnTo.z)
        explorer.body.velocity.set(0, 0, 0)
        if(this.returnToThirdPerson && explorer.firstPerson) explorer.toggleView()
        this.returnToThirdPerson = false
        this.active = null
        this.returnTo = null
        document.body.classList.remove('is-indoors')
        this.world.ambientSounds?.setEnclosure(0)
        this.world.sounds?.setWorldDuck(0)
        this.world.sounds?.cues?.door('home')
        this.$panel.hidden = true
    }

    update()
    {
        // Screens and lamps lift after dark, matching the facade outside.
        const glowing = (this.world.advancedLighting ? this.world.advancedLighting.nightFactor : 0) > 0.45
        if(glowing !== this.litAtNight)
        {
            this.litAtNight = glowing
            for(const entry of this.lit) entry.mesh.material = createInteriorMaterial(entry.colour, glowing ? 0.45 : 0.12)
        }
        if(!this.active) return
        // If anything else teleported the walker (a nav button, the arcade),
        // drop the indoor state rather than leaving the bar stranded on screen.
        const explorer = this.world.explorer
        if(!explorer.firstPerson) explorer.toggleView()

        const p = explorer.body.position
        if(Math.hypot(p.x - ROOM_ORIGIN.x, p.y - ROOM_ORIGIN.y) > 14) this.leave()
    }
}
