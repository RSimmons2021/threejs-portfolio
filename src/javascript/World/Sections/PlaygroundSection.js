import * as THREE from 'three'

// Physical toys live here; Arcade owns the timed rounds and their UI.
export default class PlaygroundSection
{
    constructor(options)
    {
        Object.assign(this, options)
        this.container = new THREE.Group()
        this.setBowling()
        this.setBricks()
    }

    setBowling()
    {
        this.bowling = { pins: { items: [] } }
        // Compound collider matches the new 1.6-unit Blender pin, not the
        // retired taller asset. A low center of mass keeps upright pins stable.
        const pinCollision = new THREE.Group()
        for(const [name,x,y,z,sx,sy,sz] of [
            ['center',0,0,.55,1,1,1], ['cylinder',0,0,.45,.34,.34,.9],
            ['sphere',0,0,1.35,.24,.24,.24]
        ])
        {
            const shape = new THREE.Object3D()
            shape.name = name
            shape.position.set(x,y,z)
            shape.scale.set(sx,sy,sz)
            pinCollision.add(shape)
        }
        for(let row = 0; row < 4; row++) for(let col = 0; col <= row; col++)
        {
            this.bowling.pins.items.push(this.objects.add({
                base: this.resources.items.arcadePin.scene,
                collision: pinCollision,
                offset: new THREE.Vector3(-46 - row * 0.8, -45 + (col - row / 2) * 1.1, 0.1),
                rotation: new THREE.Euler(), duplicated: true, mass: 0.1,
                shadow: { sizeX: 1.4, sizeY: 1.4, offsetZ: -0.1, alpha: 0.35 }, soundName: 'bowlingPin'
            }))
        }
        this.bowling.ball = this.objects.add({
            base: this.resources.items.bowlingBallBase.scene,
            collision: this.resources.items.bowlingBallCollision.scene,
            offset: new THREE.Vector3(-29, -45, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0),
            duplicated: true, mass: 1, soundName: 'bowlingBall',
            shadow: { sizeX: 1.5, sizeY: 1.5, offsetZ: -0.1, alpha: 0.35 }
        })
        this.bowling.reset = () =>
        {
            for(const item of [...this.bowling.pins.items, this.bowling.ball])
            {
                item.collision.reset()
                const body = item.collision.body
                body.velocity.set(0,0,0)
                body.angularVelocity.set(0,0,0)
                body.force.set(0,0,0)
                body.torque.set(0,0,0)
                body.wakeUp()
            }
        }
    }

    setBricks()
    {
        // A small, optional smash wall off the racing route.
        this.bricks = this.walls.add({
            object: {
                base: this.resources.items.brickBase.scene, collision: this.resources.items.brickCollision.scene,
                offset: new THREE.Vector3(), rotation: new THREE.Euler(), duplicated: true, mass: 0.5,
                shadow: { sizeX: 1.2, sizeY: 1.8, offsetZ: -0.1, alpha: 0.3 }, soundName: 'brick'
            },
            shape: {
                type: 'rectangle', widthCount: 4, heightCount: 3,
                position: new THREE.Vector3(-36, -53, 0), offsetWidth: new THREE.Vector3(1.1, 0, 0),
                offsetHeight: new THREE.Vector3(0, 0, 0.45), randomOffset: new THREE.Vector3(), randomRotation: new THREE.Vector3()
            }
        })
        this.resetBricks = () => { for(const brick of this.bricks.items) brick.collision.reset() }
    }
}
