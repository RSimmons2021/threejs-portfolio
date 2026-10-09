import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import CameraRig from '../src/javascript/World/CameraRig.js'
import CANNON from 'cannon'
import NeonProjects from '../src/javascript/World/NeonProjects.js'
import { heldMovementYaw, movementVector } from '../src/javascript/World/movementRules.js'

test('third-person chase stays behind a turning walker and skateboarder', () =>
{
    for(const skating of [false, true])
    {
        const rig = Object.create(CameraRig.prototype)
        const camera = { instance: new THREE.PerspectiveCamera(), shake: { offset: new THREE.Vector3() }, fovKick: {} }
        const explorer = { active: true, firstPerson: false, skating, heading: Math.PI / 2, renderPosition: new THREE.Vector3(0,0,.4), body: { velocity: { x: 0, y: skating ? 7.6 : 3.2 } } }
        rig.world = { camera, explorer, car: {}, physics: { car: {} }, controls: { getViewYaw: () => 0 }, arcade: { state: 'idle' } }
        Object.assign(rig, { camera, instance: camera.instance, mode: 'chase', colliders: [], yaw: 0, wasOnFoot: true, orbit: { yaw: 0, pitch: 0, idle: 0, drag: null }, distanceScale: 1, pull: 1, initialised: false, ray: new THREE.Ray() })
        for(const name of ['position','look','desired','target','hit','toCam','ahead','lastSubject']) rig[name] = new THREE.Vector3()
        for(let i = 0; i < 120; i++) rig.update(1000 / 60)
        assert.ok(camera.instance.position.y < -3, `camera should be behind the character facing +Y, actual y=${camera.instance.position.y}`)
        assert.ok(Math.abs(camera.instance.position.x) < .2)
        explorer.heading = -Math.PI / 2
        for(let i = 0; i < 120; i++) rig.update(1000 / 60)
        assert.ok(camera.instance.position.y > 3, 'camera follows a subsequent turn too')
    }
})

test('held movement keeps its world direction while the chase camera recentres', () =>
{
    const state = { held: false, yaw: 0 }
    for(let i = 0; i < 120; i++)
    {
        const yaw = heldMovementYaw(state, 0, 1, i === 0 ? 0 : -Math.PI / 2 * i / 120)
        assert.equal(yaw, 0)
        assert.deepEqual(movementVector(0, 1, yaw, 3.2), { x: 0, y: -3.2 })
    }
    heldMovementYaw(state, 0, 0, -.8)
    assert.equal(heldMovementYaw(state, 1, 0, -.8), -.8, 'a new gesture uses the current view')
    assert.equal(heldMovementYaw(state, 1, 0, 1.2, true), 1.2, 'deliberate orbit/first-person look stays responsive')
})

test('project collision bounds match transformed artwork and stop a moving walker', () =>
{
    const physics = new CANNON.World(), bodies = []
    const geometry = new THREE.BoxGeometry(3, .25, 3)
    geometry.translate(0,0,1.5)
    const world = { neonCity: {
        kit: new Map([['kit_holo_panel_lod0', [{ geometry }]]]),
        addBox(center, size, rotation, role)
        {
            const body = new CANNON.Body({ mass: 0 })
            body.position.set(...center)
            body.addShape(new CANNON.Box(new CANNON.Vec3(...size.map(v => v / 2))))
            body.collisionRole = role
            physics.addBody(body); bodies.push(body)
        }
    } }
    NeonProjects.prototype.addCollision(world, 'holo_panel', new THREE.Matrix4().makeTranslation(10,-5,0))
    assert.equal(bodies.length, 1)
    assert.equal(bodies[0].collisionRole, 'project-board')
    assert.deepEqual(bodies[0].position.toArray(), [10,-5,1.5])
    const walker = new CANNON.Body({ mass: 65, fixedRotation: true })
    walker.addShape(new CANNON.Sphere(.38)); walker.position.set(10,-7,1.2); walker.velocity.set(0,6,0)
    physics.addBody(walker)
    let contacts = 0
    walker.addEventListener('collide', e => { if(e.body === bodies[0]) contacts++ })
    for(let i = 0; i < 40; i++) physics.step(1 / 60)
    assert.ok(contacts > 0, 'actual Cannon contact must occur')
    assert.ok(walker.position.y < -5.45, 'walker cannot pass through the panel')
    geometry.dispose()
})
