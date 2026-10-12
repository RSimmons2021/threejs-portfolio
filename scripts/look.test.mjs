import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildGroundOcclusion } from '../src/javascript/World/groundOcclusion.js'
import { shotFromSearch } from '../src/javascript/World/LookShots.js'

const layout = JSON.parse(readFileSync(new URL('../static/models/cyber/district-layout.json', import.meta.url)))

test('ground occlusion darkens the pavement beside a tower but not open road', () =>
{
    const { texture, bounds } = buildGroundOcclusion(layout)
    const { data, width, height } = texture.image
    const sample = (x, y) =>
    {
        const i = Math.floor((x - bounds.x) / bounds.z * width), j = Math.floor((y - bounds.y) / bounds.w * height)
        return data[j * width + i] / 255
    }
    const [x0, y0, x1, y1] = layout.towers.find(t => t.id === 'block_06').footprint
    const kerb = sample((x0 + x1) / 2, y1 + 0.8)
    const open = sample(-60, -75)
    assert.ok(kerb < 0.8, `kerb beside block_06 should be occluded, got ${kerb}`)
    assert.ok(open > 0.97, `open ground should be unoccluded, got ${open}`)
    assert.ok(data.every(v => v >= 51), 'occlusion never goes fully black')
})

test('look-review shots only accept known names', () =>
{
    assert.equal(shotFromSearch('?shot=aerial'), 'aerial')
    assert.equal(shotFromSearch('?shot=avenue&time=13:00'), 'avenue')
    assert.equal(shotFromSearch('?shot=__proto__'), null)
    assert.equal(shotFromSearch(''), null)
})
