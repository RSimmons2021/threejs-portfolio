import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import SkateStance from '../src/javascript/World/SkateStance.js'
import { ENTRY_HEIGHT, isInsideArea } from '../src/javascript/World/areaRules.js'

const area = { position: { x: 30, y: -27 }, halfExtents: { x: 3, y: 2 }, floorZ: 0, skyAccess: true, entryHeight: ENTRY_HEIGHT }
test('entry columns accept ground and flight up to the visible ceiling', () => {
    for(const z of [0.6, 12, 35, 70, ENTRY_HEIGHT]) assert.ok(isInsideArea(area, { x: 30, y: -27, z }, z > 3))
    assert.equal(isInsideArea(area, { x: 30, y: -27, z: ENTRY_HEIGHT + 0.1 }, true), false)
    assert.equal(isInsideArea(area, { x: 34, y: -27, z: 35 }, true), false)
    assert.equal(isInsideArea(area, { x: 30, y: -30, z: 35 }, true), false)
    assert.equal(isInsideArea(area, { x: 30, y: -27, z: -2 }), false)
})
test('NPC conversations and interior stations remain ground-only', () => {
    const ground = { ...area, skyAccess: false }
    assert.ok(isInsideArea(ground, { x: 30, y: -27, z: 0.6 }))
    assert.equal(isInsideArea(ground, { x: 30, y: -27, z: 0.6 }, true), false)
    assert.equal(isInsideArea(ground, { x: 30, y: -27, z: 35 }), false)
})
test('Blender skate clip keeps both boot soles on the deck and the head upright through its whole loop', async () => {
    const buffer = fs.readFileSync(new URL('../static/models/cyber/player.glb', import.meta.url))
    const gltf = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '')
    const root = gltf.scene, stance = new SkateStance(root), mixer = new THREE.AnimationMixer(root)
    mixer.clipAction(gltf.animations.find(c => c.name === 'skate')).play()
    root.rotation.z = 1.3; root.position.set(20, -17, 0.135)
    const mesh = root.getObjectByProperty('type', 'SkinnedMesh')
    const indices = mesh.geometry.attributes.skinIndex
    const feet = mesh.skeleton.bones.map((b, i) => /^foot[LR]$/.test(b.name) ? i : -1).filter(i => i >= 0)
    const v = new THREE.Vector3(), up = new THREE.Vector3(), q = new THREE.Quaternion()
    for(let sample = 0; sample < 80; sample++) {
        mixer.update(1 / 60); stance.update(); root.updateMatrixWorld(true); mesh.skeleton.update()
        const bounds = feet.map(() => new THREE.Box3())
        for(let i = 0; i < indices.count; i++) {
            const side = feet.indexOf(indices.getX(i))
            if(side < 0) continue
            mesh.getVertexPosition(i, v); v.applyMatrix4(mesh.matrixWorld); root.worldToLocal(v)
            bounds[side].expandByPoint(v)
        }
        for(const b of bounds) {
            assert.ok(Math.abs(b.min.z + 0.005) < 0.002, `sole contact: ${b.min.z}`)
            assert.ok(b.min.x > -0.22 && b.max.x < 0.22, `inside deck width: ${b.min.x}..${b.max.x}`)
            assert.ok(b.min.y > -0.60 && b.max.y < 0.60, 'inside flat grip section')
        }
        stance.head.getWorldQuaternion(q); up.set(0, 1, 0).applyQuaternion(q)
        assert.ok(up.z > 0.9999, `upright head: ${up.z}`)
    }
})
