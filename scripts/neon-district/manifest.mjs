// Regenerates static/models/cyber/manifest.json from the files on disk.
// node scripts/neon-district/manifest.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../static/models/cyber')
const old = fs.existsSync(path.join(dir, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'))) : {}
const files = {}
for(const f of fs.readdirSync(dir).filter(f => f.endsWith('.glb'))) {
    const b = fs.readFileSync(path.join(dir, f))
    const j = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)))
    let tris = 0
    for(const m of j.meshes || []) for(const p of m.primitives) tris += j.accessors[p.indices ?? p.attributes.POSITION].count / 3
    files[f] = { bytes: b.length, triangles: Math.round(tris), nodes: (j.nodes || []).map(n => n.name).filter(n => f !== 'city-kit.glb' || n.startsWith('kit_')),
        materials: (j.materials || []).map(m => m.name), animations: (j.animations || []).map(a => a.name) }
}
for(const f of fs.readdirSync(path.join(dir, 'textures'))) files[`textures/${f}`] = { bytes: fs.statSync(path.join(dir, 'textures', f)).size }
for(const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'manifest.json')) files[f] = { bytes: fs.statSync(path.join(dir, f)).size }
const manifest = { ...old, generated: new Date().toISOString().slice(0, 10), totalBytes: Object.values(files).reduce((s, f) => s + f.bytes, 0), files }
manifest.conventions = { ...(old.conventions || {}), materialSlots: { ...(old.conventions?.materialSlots || {}),
    nd_card: 'mini-game card / icon face, uv 0..1 -> minigame-atlas.json rect', nd_belt: 'conveyor belt, scroll V over time',
    nd_window: 'interior window: map textures/apartment_window.jpg (or a live render target)' } }
fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1))
console.log('manifest', manifest.totalBytes, Object.keys(files).length, 'files')
