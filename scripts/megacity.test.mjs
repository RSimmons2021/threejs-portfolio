import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from 'three'
import { megacityProfile } from '../src/javascript/World/megacityProfile.js'
import { decodePlacements, pickLod, cropProxy, TILE_PROXIES } from '../src/javascript/World/MegacityRing.js'
import { skyRotation, environmentEuler, ringSunDirection, SKY_AZIMUTH } from '../src/javascript/World/MegacityAtmosphere.js'

const root = new URL('../static/models/megacity/', import.meta.url)
const manifest = JSON.parse(fs.readFileSync(new URL('ring.json', root)))
const layout = JSON.parse(fs.readFileSync(new URL('../static/models/cyber/district-layout.json', import.meta.url)))

test('tiers: low draws no ring, phones are capped, desktops scale up', () =>
{
    assert.equal(megacityProfile('low'), null)
    const medium = megacityProfile('medium'), high = megacityProfile('high'), ultra = megacityProfile('ultra')
    assert.ok(medium.bands < high.bands && high.bands < ultra.bands)
    assert.equal(medium.shadow, 0)
    const phoneUltra = megacityProfile('ultra', { mobile: true })
    assert.ok(phoneUltra.bands <= 2 && phoneUltra.shadow <= 2048 && phoneUltra.max <= 800)
    assert.ok(manifest.bands.length >= ultra.bands, 'every band a tier asks for exists')
})

test('placements decode position, rotation, uniform and mirrored scale', () =>
{
    const buffer = new ArrayBuffer(30)
    const view = new DataView(buffer)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.7)
    view.setUint16(0, 7, true)
    ;[12.5, -40, 3].forEach((v, i) => view.setFloat32(4 + i * 4, v, true))
    ;[q.x, q.y, q.z, q.w].forEach((v, i) => view.setInt16(16 + i * 2, Math.round(v * 32767), true))
    ;[-1.5, 1.5, 1.5].forEach((v, i) => view.setUint16(24 + i * 2, THREE.DataUtils.toHalfFloat(v), true))
    let seen
    const count = decodePlacements(buffer, new THREE.Matrix4(), (model, matrix) => { seen = { model, matrix: matrix.clone() } })
    assert.equal(count, 1)
    assert.equal(seen.model, 7)
    const expected = new THREE.Matrix4().compose(new THREE.Vector3(12.5, -40, 3), q, new THREE.Vector3(-1.5, 1.5, 1.5))
    seen.matrix.elements.forEach((v, i) => assert.ok(Math.abs(v - expected.elements[i]) < 1e-3, `element ${i}`))
    assert.ok(seen.matrix.determinant() < 0, 'mirrored placements stay mirrored')
})

test('LOD distance scales with object size', () =>
{
    assert.equal(pickLod(50, 25, 110, 380), 0, 'a 25 m wall tile is full detail at 50 m')
    assert.equal(pickLod(50, 1, 110, 380), 1, 'a 1 m unit is not')
    assert.equal(pickLod(120, 1, 110, 380), 2)
    assert.equal(pickLod(400, 50, 110, 380), 2)
})

test('cropped wall proxies keep the facade scale', () =>
{
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 50, 0, 0, 0, 25, 0, 0, 25, 0, 50], 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 0, 0.5, 0.25, 0.5, 0.25, 1], 2))
    const half = cropProxy(g, 0.5)
    assert.equal(half.attributes.position.getZ(0), 25)
    assert.ok(Math.abs(half.attributes.uv.getY(0) - 0.75) < 1e-6)
    assert.equal(half.attributes.position.getZ(1), 0)
    assert.ok(TILE_PROXIES.every(rule => manifest.models.some(m => m.name === rule.proxy)), 'every proxy model ships')
})

test('the HDR sky is rotated, not mirrored, and its sun sits over the baked sun', () =>
{
    const r = skyRotation()
    assert.ok(Math.abs(r.determinant() - 1) < 1e-9)
    const bakedSun = new THREE.Vector3(-0.277, -0.76, 0.588).normalize()
    const e = bakedSun.clone().applyMatrix3(r)
    // Equirect azimuth of the HDR's sun (found from the image: about 122.8 degrees).
    assert.ok(Math.abs(THREE.MathUtils.radToDeg(Math.atan2(e.z, e.x)) - 122.8) < 1, `azimuth ${Math.atan2(e.z, e.x)}`)
    assert.ok(e.y > 0, 'sun stays above the horizon')
    // three.js negates environmentRotation before building the matrix.
    const e2 = environmentEuler(r)
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-e2.x, -e2.y, -e2.z, 'XYZ'))
    const back = new THREE.Matrix3().setFromMatrix4(m)
    back.elements.forEach((v, i) => assert.ok(Math.abs(v - r.elements[i]) < 1e-9))
    const ring = ringSunDirection(bakedSun)
    assert.ok(Math.abs(Math.atan2(ring.y, ring.x) - Math.atan2(bakedSun.y, bakedSun.x)) < 1e-9, 'ring sun keeps the azimuth')
    assert.ok(ring.z > bakedSun.z, 'and rises higher')
    void SKY_AZIMUTH
})

test('the clearing holds the whole district and nothing low stands in it', () =>
{
    const c = manifest.frame.clearing
    for(const tower of layout.towers)
    {
        const [x0, y0, x1, y1] = tower.footprint
        assert.ok(x0 >= c.x0 && x1 <= c.x1 && y0 >= c.y0 && y1 <= c.y1, `${tower.id} inside the clearing`)
    }
    for(const band of manifest.bands)
    {
        const buffer = fs.readFileSync(new URL(band.url, root))
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        let inside = 0
        decodePlacements(arrayBuffer, new THREE.Matrix4(), (model, matrix, p) =>
        {
            if(p.x > c.x0 + 5 && p.x < c.x1 - 5 && p.y > c.y0 + 5 && p.y < c.y1 - 5 && p.z < 100) inside++
        })
        assert.equal(inside, 0, `${band.name}: no placement origin low inside the clearing`)
        assert.equal(buffer.length, band.count * 30)
    }
})

test('every model, texture and the sky referenced by the manifest ships', () =>
{
    for(const model of manifest.models) assert.ok(fs.existsSync(new URL(model.url, root)), model.url)
    for(const roles of Object.values(manifest.textures))
        for(const sizes of Object.values(roles))
            for(const url of Object.values(sizes)) assert.ok(fs.existsSync(new URL(url, root)), url)
    assert.ok(fs.existsSync(new URL(manifest.sky, root)))
})

test('Megacity collision: height map queries, camera rays and the tower guard', async () =>
{
    const { default: MegacityCollision } = await import('../src/javascript/World/MegacityCollision.js')
    const { ceilingVelocity, FLIGHT_CEILING, MEGACITY_CEILING } = await import('../src/javascript/World/flightRules.js')
    const meta = manifest.collision
    const buffer = fs.readFileSync(new URL(meta.url, root))
    const field = new MegacityCollision(meta, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    const c = manifest.frame.clearing
    // The district clearing is flat: its own colliders own it.
    for(let x = c.x0; x <= c.x1; x += 10) for(let y = c.y0; y <= c.y1; y += 10) assert.equal(field.heightAt(x, y), 0)
    // A synthetic 4 x 4 field with one 50 m tower.
    const tiny = new MegacityCollision({ origin: [0, 0], cell: 4, nx: 4, ny: 4 }, new Uint16Array([0, 0, 0, 0, 0, 500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]).buffer)
    assert.equal(tiny.heightAt(5, 5), 50)
    assert.equal(tiny.heightAt(-5, 5), 0, 'outside the map is street')
    const hit = tiny.rayDistance(new THREE.Vector3(1, 6, 10), new THREE.Vector3(1, 0, 0), 20)
    assert.ok(hit > 0 && hit < 4, `camera ray stops at the tower (${hit})`)
    // The guard puts a body pushed into a column back on its last valid spot.
    const body = { position: { x: 2, y: 6, z: 1 }, velocity: { x: 5, y: 0, z: 0 } }, memory = {}
    assert.equal(tiny.guard(body, memory), false)
    body.position.x = 5
    assert.equal(tiny.guard(body, memory), true)
    assert.equal(body.position.x, 2)
    assert.ok(body.velocity.x <= 1e-9, 'velocity into the wall is removed')
    body.position.z = 60; body.position.x = 5
    assert.equal(tiny.guard(body, memory), false, 'a rooftop is fine')
    // The sky opens above the towers with the ring; the district ceiling is unchanged.
    assert.ok(ceilingVelocity(300, 5) < 0, 'district ceiling still applies without the ring')
    assert.equal(ceilingVelocity(300, 5, MEGACITY_CEILING), 5)
    assert.ok(MEGACITY_CEILING > FLIGHT_CEILING)
    for(const tier of ['medium', 'high', 'ultra']) assert.ok(megacityProfile(tier).explore > 0)
    assert.ok(megacityProfile('ultra', { mobile: true }).explore <= 600)
})
