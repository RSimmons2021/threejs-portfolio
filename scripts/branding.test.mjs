import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = path => readFileSync(resolve(root, path))
const html = read('src/index.html').toString()
const pngSize = bytes => [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]

test('RS favicon source and all browser/app fallbacks agree', () =>
{
    const svg = read('static/favicon/favicon.svg').toString()
    assert.match(svg, /<title>RS — Richard Simmons<\/title>/)
    assert.match(svg, /#07131e/)
    const sizes = { 'favicon-16x16.png': 16, 'favicon-32x32.png': 32,
        'apple-touch-icon.png': 180, 'android-chrome-192x192.png': 192,
        'android-chrome-256x256.png': 256, 'mstile-150x150.png': 150 }
    for(const [name, size] of Object.entries(sizes))
    {
        const png = read(`static/favicon/${name}`)
        assert.deepEqual(pngSize(png), [size, size], name)
        assert.deepEqual(png, read(`src/favicon/${name}`), `${name} copies are identical`)
    }
    const ico = read('static/favicon/favicon.ico')
    assert.equal(ico.readUInt16LE(2), 1)
    assert.equal(ico.readUInt16LE(4), 4, 'ICO contains 16, 32, 48 and 64 px variants')
    assert.deepEqual(ico, read('src/favicon/favicon.ico'))
    const manifest = JSON.parse(read('static/favicon/site.webmanifest'))
    assert.equal(manifest.theme_color, '#07131e')
    for(const icon of manifest.icons) assert.ok(existsSync(resolve(root, 'static', icon.src.split('?')[0].slice(1))))
    assert.match(html, /favicon\.svg\?v=rs-20261012/)
    assert.match(html, /apple-touch-icon\.png\?v=rs-20261012/)
})

test('all social tags reference the same wide Neon District diorama with accurate dimensions', () =>
{
    const names = ['itemprop="image"', 'name="twitter:image"', 'property="og:image"']
    for(const name of names)
    {
        const tag = html.split('\n').find(line => line.includes(name))
        assert.ok(tag, name)
        assert.ok(tag.includes('https://richard-simmons-portfolio.vercel.app/social/neon-district-diorama-2026-10.png'), tag)
    }
    assert.ok(!html.includes('city-explorer-2026.png'))
    assert.ok(!html.includes('/social/neon-district-2026-10.png'))
    assert.ok(!html.includes('amber typography'))
    const size = pngSize(read('static/social/neon-district-diorama-2026-10.png'))
    const metadataSize = ['width', 'height'].map(name => Number(html.match(new RegExp(`property="og:image:${name}" content="(\\d+)"`))[1]))
    assert.deepEqual(size, metadataSize)
    assert.ok(Math.abs(size[0] / size[1] - 1200 / 630) < .01, 'preserves the social-card aspect ratio')
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)[1]
    const ogUrl = html.match(/property="og:url" content="([^"]+)"/)[1]
    assert.equal(canonical, ogUrl)
})
