import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { vehicleAudioMix, cityAudioGain } from '../src/javascript/World/vehicleAudioMix.js'
import { CYBER_SOUNDS } from './cyber-sound-manifest.mjs'

test('skateboard samples are byte-for-byte unchanged', () =>
{
    const original = { off: '888aca9d1105ff9f7f5a816465e76841b979662f8df622a1bc8a5f0f04a377c1',
        push: '3a25f5b098a96d4a2a5f96851d08943001888e8459c1d9b5e6c9e7176360c029',
        roll: 'f3a584ba99561510bd1b62009aa3e4a03e88e732bb6979f088d3a3b92e0a4fa4' }
    for(const [name, hash] of Object.entries(original))
        assert.equal(createHash('sha256').update(readFileSync(`static/sounds/cues/board-${name}.mp3`)).digest('hex'), hash)
})

test('new ElevenLabs pack stays separate, bounded and present', () =>
{
    assert.equal(CYBER_SOUNDS.length, 16)
    let bytes = 0
    for(const entry of CYBER_SOUNDS)
    {
        assert.ok(/^cyber\/[a-z-]+\.mp3$/.test(entry.file))
        assert.ok(!/skate|board|intro|reveal/.test(entry.file))
        const size = statSync(`static/sounds/${entry.file}`).size
        assert.ok(size > 1000)
        bytes += size
    }
    assert.ok(bytes < 1024 * 1024)
})

test('flight gain replaces driving and increases airflow with real speed', () =>
{
    const ground = vehicleAudioMix({ speed: 1 }, true, 1, 0)
    assert.equal(ground.drive, 1); assert.equal(ground.hover, 0); assert.equal(ground.air, 0)
    const hover = vehicleAudioMix({ speed: 0, flying: true }, true, 1, 1)
    const fly = vehicleAudioMix({ speed: 1, flying: true, boost: true }, true, 1, 1)
    assert.equal(fly.drive, 0); assert.ok(fly.hover > hover.hover); assert.ok(fly.air > hover.air)
    for(const state of [{ onFoot: true }, { flying: true, onFoot: true }])
        assert.deepEqual(vehicleAudioMix(state, true, 1, 1), { drive: 0, hover: 0, air: 0 })
    assert.deepEqual(vehicleAudioMix({ speed: 1 }, false, 1, 1), { drive: 0, hover: 0, air: 0 })
    assert.equal(vehicleAudioMix({ speed: 1 }, true, 0, 1).hover, 0)
    assert.ok(hover.air > 0 && hover.air < 0.02, 'a stationary hover has barely audible wind')
    assert.ok(fly.air <= 0.07, 'even boosted airflow stays subtle')
})

test('city ambience starts after entry, ducks indoors and fades with altitude', () =>
{
    assert.equal(cityAudioGain({}, false, 1), 0)
    assert.equal(cityAudioGain({}, true, 0), 0)
    assert.equal(cityAudioGain({ onFoot: true }, true, 1), 0.06)
    assert.ok(cityAudioGain({ indoors: true }, true, 1) < 0.025)
    assert.ok(cityAudioGain({ flying: true, altitude: 160 }, true, 1) < cityAudioGain({ flying: true, altitude: 30 }, true, 1))
})
