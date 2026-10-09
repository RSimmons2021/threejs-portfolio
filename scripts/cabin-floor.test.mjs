import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { showCabinInterior } from '../src/javascript/World/CabinInterior.js'

test('the cockpit shell occludes the street at downward viewing angles', async () =>
{
    const bytes = fs.readFileSync(new URL('../static/models/cyber/hover-chassis.glb', import.meta.url))
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const shell = []
    scene.traverse(mesh => { if(mesh.isMesh && mesh.material.name === 'nd_atlas') shell.push(mesh.material) })
    for(const material of new Set(shell))
    {
        const interior = showCabinInterior(scene, material)
        assert.equal(material.side, THREE.FrontSide, 'shared exterior material is unchanged')
        assert.equal(interior.transparent, false)
        assert.equal(interior.depthWrite, true)
    }
    scene.updateMatrixWorld(true)
    const eye = new THREE.Vector3(-0.05, 0, 0.92)
    const ray = new THREE.Raycaster()
    let gaps = 0
    for(let yaw = -75; yaw <= 75; yaw += 15)
    {
        for(let pitch = -80; pitch <= -45; pitch += 5)
        {
            const a = THREE.MathUtils.degToRad(yaw), p = THREE.MathUtils.degToRad(pitch)
            ray.set(eye, new THREE.Vector3(Math.cos(a) * Math.cos(p), Math.sin(a) * Math.cos(p), Math.sin(p)))
            if(!ray.intersectObject(scene, true).some(hit => !hit.object.material.transparent)) gaps++
        }
    }
    assert.equal(gaps, 0, `${gaps} downward rays see through the cabin`)
})

test('interior keeps live day/night uniforms without changing shared material sides', () =>
{
    const material = new THREE.ShaderMaterial({ uniforms: { uDaylight: { value: 1 } } })
    const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), material)
    root.add(mesh)
    const interior = showCabinInterior(root, material)
    material.uniforms.uDaylight.value = 0
    assert.equal(interior.uniforms.uDaylight.value, 0)
    assert.equal(mesh.material, interior)
    assert.notEqual(interior, material)
    assert.equal(material.side, THREE.FrontSide)
    root.children[0].geometry.dispose(); interior.dispose(); material.dispose()
})
