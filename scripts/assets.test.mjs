import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import projects, { worldProjects } from '../src/javascript/World/Sections/projectCatalog.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readGlb = (name) => {
    const buffer = fs.readFileSync(path.join(root, 'static/models/nyc', `${name}.glb`))
    assert.equal(buffer.toString('utf8', 0, 4), 'glTF')
    assert.equal(buffer.readUInt32LE(4), 2)
    assert.equal(buffer.readUInt32LE(8), buffer.length)
    return { buffer, json: JSON.parse(buffer.subarray(20, 20 + buffer.readUInt32LE(12))) }
}

test('gallery has the requested order, destinations, and all 18 billboards', () => {
    assert.deepEqual(projects.map(p => p.slug), ['zoan', 'agent-lab', 'deepseek', 'agent-relay', 'lucid', 'aso-agent'])
    assert.deepEqual(projects.map(p => p.href), [
        'https://zoancollective.site', 'https://ai-agent-portal-site.vercel.app/',
        'https://github.com/RSimmons2021/deepseek-harness-desktop',
        'https://openai-agent-site.vercel.app/', 'https://www.lucid-app.xyz/',
        'https://layers-aso-agent.vercel.app/'
    ])
    for(const project of worldProjects) {
        assert.equal(project.imageSources.length, 3)
        for(const source of project.imageSources) {
            const svg = fs.readFileSync(path.join(root, 'static', source), 'utf8')
            assert.match(svg, /viewBox="0 0 1200 700"/)
            assert.ok(svg.includes(`<title>${project.name}`))
        }
    }
})

test('Blender exports contain only the selected portfolio scene and bounded geometry', () => {
    for(const name of ['f1-chassis', 'f1-wheel', 'f1-brake', 'f1-reverse', 'f1-antenna', 'manhattan', 'link-github', 'link-linkedin', 'link-email', 'link-portfolio']) {
        const { buffer, json } = readGlb(name)
        assert.equal(json.scenes.length, 1, `${name}: unrelated Blender scenes must never be exported`)
        assert.ok(json.nodes.every(node => node.name.startsWith('cel_')), name)
        assert.ok(buffer.length < (name === 'manhattan' ? 2_200_000 : 50_000), `${name}: asset budget`)
        const triangles = json.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((sum, p) => sum + json.accessors[p.indices].count / 3, 0), 0)
        assert.ok(triangles < (name === 'manhattan' ? 40_000 : 2_000), `${name}: triangle budget`)
    }
})

test('car palette survives GLB export and wheel coordinates stay centered on the axle', () => {
    const car = readGlb('f1-chassis').json
    const colors = car.materials.map(m => m.pbrMetallicRoughness.baseColorFactor.join(','))
    assert.ok(new Set(colors).size >= 4, 'Blender materials must not collapse to default gray')
    const wheel = readGlb('f1-wheel').json
    for(const mesh of wheel.meshes) for(const primitive of mesh.primitives) {
        const bounds = wheel.accessors[primitive.attributes.POSITION]
        assert.ok(Math.abs(bounds.min[0] + bounds.max[0]) < .001)
        assert.ok(Math.abs(bounds.min[2] + bounds.max[2]) < .001)
        assert.ok(Math.max(...bounds.max.map(Math.abs)) <= .32)
    }
})

test('contact links remain clear of the foreground tower', () => {
    const city = readGlb('manhattan').json
    const blocks = new Set(city.nodes.map(node => node.name.match(/block[ _](\d+)/)?.[1]).filter(Boolean))
    assert.equal(blocks.size, 36)
    assert.ok(!blocks.has('32'), 'foreground block 32 must not generate meshes, shadows, or colliders')
})
