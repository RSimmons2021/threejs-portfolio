import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

// Neon District assets (static/models/cyber). Built in Blender by
// scripts/neon-district/*.py; see docs/neon-district-assets.md.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'static/models/cyber')
const readJson = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))
const readGlb = (name) => {
    const buffer = fs.readFileSync(path.join(dir, `${name}.glb`))
    assert.equal(buffer.toString('utf8', 0, 4), 'glTF')
    assert.equal(buffer.readUInt32LE(4), 2)
    assert.equal(buffer.readUInt32LE(8), buffer.length)
    return { buffer, json: JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12))) }
}
const triangles = (json) => json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((s, p) =>
    s + json.accessors[p.indices ?? p.attributes.POSITION].count / 3, 0), 0)
const attributes = (json) => new Set(json.meshes.flatMap(mesh => mesh.primitives.flatMap(p => Object.keys(p.attributes))))

const BUDGETS = {
    'city-kit': [700_000, 8_000], 'hover-chassis': [100_000, 1_200], 'hover-wheel': [50_000, 500],
    'hover-brake': [10_000, 60], 'hover-reverse': [10_000, 60], 'hover-antenna': [10_000, 60],
    'hover-thrusters': [20_000, 200], 'hover-car-assembled': [200_000, 1_600], 'traffic': [120_000, 1_200],
    'player': [200_000, 4_000], 'npc': [60_000, 2_500], 'hoverboard': [20_000, 200], 'skateboard': [30_000, 400],
    'apartment-interior': [180_000, 2_000], 'minigames': [700_000, 7_000]
}

test('every Neon District GLB is a single Z-up scene within its byte and triangle budget', () => {
    for(const [name, [bytes, tris]] of Object.entries(BUDGETS)) {
        const { buffer, json } = readGlb(name)
        assert.equal(json.scenes.length, 1, `${name}: only the selected objects are exported`)
        assert.ok(buffer.length <= bytes, `${name}: ${buffer.length} bytes > ${bytes}`)
        assert.ok(triangles(json) <= tris, `${name}: ${triangles(json)} triangles > ${tris}`)
        const attrs = attributes(json)
        for(const required of ['POSITION', 'NORMAL', 'TEXCOORD_0', 'COLOR_0']) assert.ok(attrs.has(required), `${name}: ${required}`)
        assert.ok(json.materials.every(m => m.name.startsWith('nd_')), `${name}: only nd_* material slots`)
        assert.ok(!json.images && !json.textures, `${name}: textures ship separately as the shared atlas`)
    }
})

test('city kit has every module the layout places, with LODs and anchors', () => {
    const { json } = readGlb('city-kit')
    const names = new Set(json.nodes.map(n => n.name))
    const layout = readJson('district-layout.json')
    for(const module of Object.keys(layout.instances)) assert.ok(names.has(`kit_${module}_lod0`), module)
    for(const module of ['wall_window', 'wall_strip', 'wall_balcony', 'storefront', 'storefront_door', 'skybridge', 'rooftop_pad'])
        assert.ok(names.has(`kit_${module}_lod1`), `${module} lod1`)
    for(const anchor of ['anchor_door', 'anchor_lift', 'anchor_spawn', 'anchor_steam', 'anchor_sign_0', 'anchor_beam_0', 'anchor_light_0'])
        assert.ok([...names].some(n => n.startsWith(anchor)), anchor)
})

test('district layout keeps every career door, four rooftop pads and the flight envelope', () => {
    const layout = readJson('district-layout.json')
    const doors = [[0, 10.6, 'loopp'], [-6.9, -20.1, 'zoan'], [6.9, -20.1, 'toyota'], [-13, -62.9, 'knoesis'],
        [-6.9, -43.1, 'gym'], [6.9, -43.1, 'signal'], [17.9, -48.1, 'wright'], [-9, 8.6, 'homelab'],
        [10, 10.1, 'supply'], [-17, 6.1, 'cabinet'], [-14.9, -6.1, 'agentlab'], [-28, -19.3, 'agentrelay']]
    for(const [x, y, id] of doors) {
        const door = layout.doors.find(d => d.id === id)
        assert.ok(door, id)
        assert.ok(Math.hypot(door.p[0] - x, door.p[1] - y) < 1.2, `${id} door anchor drifted`)
    }
    assert.deepEqual(layout.pads.map(p => p.id).sort(), ['avenue', 'crossroads', 'information', 'intro'])
    assert.equal(layout.heroBillboards.filter(b => b.project !== undefined).length, 6)
    assert.ok(layout.flightBounds.max[2] >= 62 && layout.flightBounds.max[2] <= 80)
    // New infill towers must stay off the avenue, its south sidewalk route and the sprint gates.
    for(const tower of layout.towers.filter(t => t.kind === 'infill')) {
        const [x0, y0, x1, y1] = tower.footprint
        for(const [px, py] of [[5, -29], [53, -29], [101, -29], [145, -29], [137, -35], [89, -35], [41, -35], [-20, -35], [30, -38], [142, -38], [1.2, -55], [-38, -34]])
            assert.ok(!(px > x0 && px < x1 && py > y0 && py < y1), `${tower.id} covers ${px},${py}`)
    }
})

test('hero car drives and flies: parts, transform clips and the cockpit screens', () => {
    const spec = readJson('hover-car.json')
    assert.deepEqual(Object.keys(spec.wheels).sort(), ['wheel_BL', 'wheel_BR', 'wheel_FL', 'wheel_FR'])
    for(const wheel of Object.values(spec.wheels)) assert.equal(wheel.drive.rotX, 0)
    const { json } = readGlb('hover-car-assembled')
    assert.deepEqual(json.animations.map(a => a.name).sort(), ['drive_to_fly', 'fly_to_drive'])
    const chassis = readGlb('hover-chassis').json
    for(const slot of ['nd_glass', 'nd_dash', 'nd_mirror', 'nd_hud']) assert.ok(chassis.materials.some(m => m.name === slot), slot)
    assert.ok(readGlb('hover-wheel').json.materials.some(m => m.name === 'nd_thruster'))
    assert.ok(fs.existsSync(path.join(dir, 'textures/dash_mock.png')))
})

test('characters: skinned player clips and a vertex-animated crowd', () => {
    const player = readGlb('player').json
    assert.equal(player.skins.length, 1)
    assert.deepEqual(player.animations.map(a => a.name).sort(), ['enter_car', 'idle', 'run', 'skate', 'walk', 'wave'])
    const npc = readGlb('npc').json
    assert.ok(attributes(npc).has('TEXCOORD_1'), 'VAT lookup uv')
    const vat = readJson('npc-vat.json')
    assert.equal(vat.frames, Object.values(vat.clips).reduce((s, c) => s + c.frames, 0))
    assert.ok(vat.vertices <= 2048, 'VAT width fits every mobile GPU')
    assert.ok(fs.existsSync(path.join(dir, vat.texture)))
})

test('boards and signs', () => {
    assert.equal(readGlb('skateboard').json.nodes.filter(n => n.name.startsWith('skateboard_wheel_')).length, 4)
    const signs = readJson('signs-atlas.json')
    assert.ok(signs.designs.length >= 24)
    for(const d of signs.designs) assert.ok(d.uv.every(v => v >= 0 && v <= 1) && d.uv[2] > d.uv[0] && d.uv[3] > d.uv[1], `sign ${d.id}`)
    assert.ok(signs.designs.some(d => d.kind === 'name' && d.text === 'RICHARD SIMMONS'))
})

// Lazy files load only when the visitor enters an interior or starts a mini-game.
const LAZY = /^(minigames|minigame|apartment|textures\/(minigame_atlas|apartment_window|dash_mock))/
test('budgets: first load under 4 MB, everything under 6 MB', () => {
    const manifest = readJson('manifest.json')
    const first = Object.entries(manifest.files).filter(([f]) => !LAZY.test(f)).reduce((s, [, f]) => s + f.bytes, 0)
    assert.ok(first < 4_000_000, `first load ${first}`)
    assert.ok(manifest.totalBytes < 6_000_000, `${manifest.totalBytes}`)
})

test('light volume covers the district and decodes', () => {
    const lv = readJson('light-volume.json')
    const layout = readJson('district-layout.json')
    assert.ok(fs.existsSync(path.join(dir, lv.texture)))
    const [nx, ny, nz] = lv.grid.dims
    assert.ok(nx * ny * nz === lv.cells && lv.grid.tiles[0] * lv.grid.tiles[1] >= nz)
    for(const t of layout.towers) {
        const [x0, y0, x1, y1] = t.footprint
        assert.ok(x0 >= lv.grid.min[0] && x1 <= lv.grid.max[0] && y0 >= lv.grid.min[1] && y1 <= lv.grid.max[1], `${t.id} outside the volume`)
    }
    assert.ok(lv.encoding.bounceScale > 0)
})

test('apartment interior keeps the room frame and its screens', () => {
    const { json } = readGlb('apartment-interior')
    const names = json.nodes.map(n => n.name)
    for(const n of ['apt_shell', 'apt_furniture_warm', 'apt_screens', 'apt_window', 'apt_posters']) assert.ok(names.includes(n), n)
    for(const slot of ['nd_screen', 'nd_window', 'nd_sign']) assert.ok(json.materials.some(m => m.name === slot), slot)
    assert.ok(fs.existsSync(path.join(dir, 'textures/apartment_window.jpg')))
})

test('mini-games: assets, arenas, routes and cards line up', () => {
    const mg = readJson('minigames.json')
    const { json } = readGlb('minigames')
    const names = new Set(json.nodes.map(n => n.name))
    for(const a of Object.values(mg.assets)) assert.ok(names.has(a.node), a.node)
    assert.equal(mg.packetRun.facilities.length, 7)
    assert.equal(mg.packetRun.racks.length, 3)
    assert.ok(mg.beatTunnel.rings.length >= 48)
    assert.deepEqual(mg.beatTunnel.blockedRings, [], 'every Beat Tunnel ring clears towers and skybridges')
    for(const [id, arena] of Object.entries(mg.arenas)) {
        assert.ok(arena.origin[0] >= 300, `${id} arena parked outside the city`)
        for(const node of [arena.shell, ...Object.keys(arena.place)]) assert.ok(names.has(node), `${id}: ${node}`)
    }
    const atlas = readJson('minigame-atlas.json')
    const kind = k => atlas.rects.filter(r => r.kind === k)
    assert.equal(kind('post').length, 20)
    assert.equal(kind('post').filter(r => r.sarcastic).length, 5)
    assert.deepEqual(new Set(kind('post').map(r => r.truth)), new Set(['positive', 'negative', 'neutral']))
    assert.equal(kind('tool').length, 8)
    assert.equal(kind('doc').length, 6)
    assert.deepEqual(kind('app').map(r => r.label).sort(), ['FOCUSFI', 'LUCID'])
})

test('traffic has six vehicle types', () => {
    const names = readGlb('traffic').json.nodes.map(n => n.name).sort()
    assert.deepEqual(names, ['traffic_bus', 'traffic_cab', 'traffic_hauler', 'traffic_pod', 'traffic_police', 'traffic_van'])
})
