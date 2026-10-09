import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { BOWLING_SOUNDS } from './bowling-sound-manifest.mjs'
import { SHOP } from '../src/javascript/World/careerData.js'
import Sounds from '../src/javascript/World/Sounds.js'

test('dedicated ElevenLabs bowling clips decode and stay lightweight', () =>
{
    assert.equal(BOWLING_SOUNDS.length, 2)
    let bytes = 0
    for(const entry of BOWLING_SOUNDS)
    {
        const file = `static/sounds/${entry.file}`
        bytes += statSync(file).size
        const decode = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], { encoding: 'utf8' })
        assert.equal(decode.status, 0, decode.stderr)
    }
    assert.ok(bytes < 50000)
    const sounds = readFileSync('src/javascript/World/Sounds.js', 'utf8')
    for(const entry of BOWLING_SOUNDS) assert.ok(sounds.includes(entry.file))
})

test('real impact player bounds pitch, gain, cooldown and simultaneous bowling voices', () =>
{
    const player = Object.create(Sounds.prototype)
    player.settings = []
    player.add = () => {}
    player.setSettings()
    for(const name of ['bowlingPin', 'bowlingBall'])
    {
        const settings = player.settings.find(item => item.name === name)
        let count = 0, gain, rate, loaded = true
        const sound = { play: () => ++count, volume: value => { gain = value }, rate: value => { rate = value }, state: () => loaded ? 'loaded' : 'loading' }
        const item = { ...settings, sounds: [sound], lastTime: 0, voices: new Set() }
        player.items = [item]
        player.playItem(name, 10)
        assert.equal(count, 1)
        assert.ok(gain <= settings.volumeMax ** 2)
        assert.ok(rate >= .9 && rate <= 1.1)
        player.playItem(name, 10)
        assert.equal(count, 1, 'same-frame collisions are throttled')
        for(let i = 1; i <= settings.maxConcurrent; i++) { item.lastTime = 0; player.playItem(name, 10) }
        assert.equal(count, settings.maxConcurrent)
        item.voices.delete(1)
        item.lastTime = 0
        player.playItem(name, 10)
        assert.equal(count, settings.maxConcurrent + 1, 'a finished voice releases capacity')
        item.voices.clear(); item.lastTime = 0; loaded = false
        player.playItem(name, 10)
        assert.equal(count, settings.maxConcurrent + 1, 'late-loaded impacts are not queued')
    }
})

test('headphones remain an inventory keepsake, never a wearable cosmetic', () =>
{
    const item = SHOP.find(item => item.id === 'headphones')
    assert.equal(item.kind, 'keepsake')
    assert.equal(item.slot, undefined)
    const source = readFileSync('src/javascript/World/CareerRPG.js', 'utf8')
    assert.ok(!source.includes("if(owned.includes('headphones'))"))
    assert.ok(source.includes("raw.equipped.filter(id => id !== 'headphones')"))
})
