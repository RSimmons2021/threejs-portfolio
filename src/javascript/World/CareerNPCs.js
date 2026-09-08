import * as THREE from 'three'
import { createPerson } from './Pedestrians.js'
import { NPCS } from './careerData.js'

// Six named people, distinct from the ambient crowd in Pedestrians.js: these
// stand still, face the player, and hold one conversation each. Like the crowd
// they get no physics body, so the walker and the car pass straight through.
const nameplate = (_name, _role, _colour) =>
{
    const canvas = document.createElement('canvas')
    canvas.width = 640
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#16130e'
    ctx.fillRect(0, 0, 640, 160)
    ctx.fillStyle = _colour
    ctx.fillRect(0, 0, 640, 8)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffe7b0'
    ctx.font = 'bold 48px Arial, sans-serif'
    ctx.fillText(_name, 320, 78)
    ctx.fillStyle = '#e7c98c'
    ctx.font = '26px monospace'
    ctx.fillText(_role, 320, 122)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

export default class CareerNPCs
{
    constructor(_world, _rpg)
    {
        this.world = _world
        this.rpg = _rpg
        this.container = new THREE.Group()
        this.container.name = 'Career NPCs / nonblocking'

        this.people = NPCS.map((_npc) => this.setPerson(_npc))

        this.world.time.on('tick', () => this.update())
    }

    setPerson(_npc)
    {
        const group = new THREE.Group()
        group.position.set(_npc.position.x, _npc.position.y, 0.09)

        const body = createPerson(this.world.materials, _npc.colour)
        group.add(body)

        const label = new THREE.Mesh(
            new THREE.PlaneGeometry(2.6, 0.65),
            new THREE.MeshBasicMaterial({ map: nameplate(_npc.name, _npc.role, _npc.colour), transparent: true, depthWrite: false })
        )
        label.position.z = 2.35
        label.rotation.x = Math.PI * 0.5
        group.add(label)

        const overhead = new THREE.Mesh(
            new THREE.PlaneGeometry(2.6, 0.65),
            new THREE.MeshBasicMaterial({ map: label.material.map, transparent: true, depthWrite: false })
        )
        overhead.position.set(0, 1.5, 2.05)
        group.add(overhead)

        label.visible = false
        this.container.add(group)

        // Areas created after Explorer already read areas.car, which resolves to
        // the walker on foot and the chassis while driving, so one zone serves both.
        const area = this.world.areas.add({
            position: new THREE.Vector2(_npc.position.x, _npc.position.y),
            halfExtents: new THREE.Vector2(2.1, 2.1),
            hasKey: true,
            testCar: true,
            active: true
        })
        area.on('interact', () => this.rpg.openNPC(_npc))
        this.rpg.registerZone(area, _npc.name, () => this.rpg.openNPC(_npc))

        return { npc: _npc, group, body, label, overhead, phase: Math.random() * Math.PI * 2 }
    }

    setView(_firstPerson)
    {
        for(const person of this.people)
        {
            person.label.visible = _firstPerson
            person.overhead.visible = !_firstPerson
        }
    }

    update()
    {
        const time = this.world.time.elapsed / 1000
        const player = this.world.explorer ? this.world.explorer.position : this.world.physics.car.chassis.body.position

        for(const person of this.people)
        {
            const dx = player.x - person.group.position.x
            const dy = player.y - person.group.position.y
            const near = dx * dx + dy * dy < 90

            // Turn to face whoever walked up; otherwise hold their own heading.
            const facing = near ? Math.atan2(dy, dx) - Math.PI / 2 : person.npc.position.facing ?? Math.PI
            const current = person.group.rotation.z
            person.group.rotation.z = current + Math.atan2(Math.sin(facing - current), Math.cos(facing - current)) * 0.08

            // The group turns to face the player, so counter-rotate the flat
            // nameplate to keep it world-aligned under the overhead camera.
            person.overhead.rotation.z = - person.group.rotation.z

            // Idle shift of weight, never the walk cycle: they are standing still.
            person.body.userData.animate(time * 1.4 + person.phase, false)
            person.body.position.z = this.world.config.reducedMotion ? 0 : Math.sin(time * 1.6 + person.phase) * 0.03
        }
    }
}
