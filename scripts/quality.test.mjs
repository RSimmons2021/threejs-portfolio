import test from 'node:test'
import assert from 'node:assert/strict'
import Quality, { detectTier, gpuClass, isMobileDevice } from '../src/javascript/Quality.js'
import { summarizeFrames } from '../src/javascript/PerformanceMonitor.js'
import { inLookSlice, previewTime, neonEnabled, entryPosition } from '../src/javascript/World/neonDistrictRules.js'

test('The plain site URL opens Neon; only an explicit zero selects legacy', () => {
    for(const search of ['', '?perf=1', '?time=13:00&weather=rain', '?neon=1', '?neon=invalid'])
        assert.equal(neonEnabled(search), true, search)
    assert.equal(neonEnabled('?neon=0'), false)
    assert.equal(neonEnabled('?neon=0&perf=1'), false)
})

test('Neon entry starts in the review crossroads without moving landmarks', () => {
    const position = entryPosition(true)
    assert.deepEqual(position, { x: 0, y: -30, z: 12 })
    assert.equal(inLookSlice(position.x, position.y), true)
    assert.deepEqual(entryPosition(false), { x: 0, y: 0, z: 12 })
})

test('Tier follows platform and GPU class; explicit valid overrides win', () => {
    // Phones: the GPU decides, capped at High.
    assert.equal(detectTier({ mobile: true, gpu: 'Adreno (TM) 830' }), 'high')
    assert.equal(detectTier({ mobile: true, gpu: 'ANGLE (Qualcomm, Adreno (TM) 825, OpenGL ES 3.2)' }), 'high')
    assert.equal(detectTier({ mobile: true, gpu: 'Adreno (TM) 650' }), 'medium')
    assert.equal(detectTier({ mobile: true, gpu: 'Adreno (TM) 506' }), 'low')
    assert.equal(detectTier({ mobile: true, gpu: 'Mali-G57 MC2' }), 'medium')
    assert.equal(detectTier({ mobile: true, gpu: 'Apple GPU' }), 'medium')
    assert.equal(detectTier({ mobile: true, gpu: 'NVIDIA GeForce RTX 4090' }), 'high')
    assert.equal(detectTier({ touch: true, override: 'low' }), 'low')
    // Desktops: integrated GPUs split by generation, discrete GPUs get Ultra.
    assert.equal(detectTier({ gpu: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 620 (KBL GT2), OpenGL 4.6)', override: 'invalid' }), 'medium')
    assert.equal(detectTier({ gpu: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' }), 'high')
    assert.equal(detectTier({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)' }), 'high')
    assert.equal(detectTier({ gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Max, Unspecified Version)' }), 'ultra')
    assert.equal(detectTier({ gpu: 'SwiftShader' }), 'low')
    assert.equal(detectTier({ gpu: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)' }), 'ultra')
    assert.equal(gpuClass('ANGLE (AMD, AMD Radeon(TM) Graphics (renoir), OpenGL 4.6)'), 'igpu-low')
    assert.equal(gpuClass('ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11)'), 'discrete')
})

test('Phones and tablets are detected before any touch event', () => {
    assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 15; A024) Chrome/140 Mobile Safari/537.36' }), true)
    assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true)
    assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', maxTouchPoints: 5 }), true)
    // A touchscreen laptop is still a desktop.
    assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140', maxTouchPoints: 10, coarsePointer: false }), false)
    assert.equal(isMobileDevice({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 10, coarsePointer: true }), false)
})

test('Governor measures unclamped frame time and respects its cooldown', () => {
    let changes = 0
    const q = new Quality({ tier: 'medium', onChange: () => changes++ })
    const window = now => { for(let i = 0; i < 45; i++) q.sample(40, now) }
    window(0)
    assert.equal(changes, 1)
    assert.equal(q.settings.dpr, 0.9)
    window(1500)
    assert.equal(changes, 1)
    window(3000)
    assert.equal(changes, 2)
    assert.equal(q.settings.dpr, 0.8)
})

test('Slow-tier transitions never increase already reduced budgets', () => {
    const q = new Quality({ tier: 'ultra', deviceDpr: 2 })
    for(let i = 0; i < 40; i++) {
        const previous = { ...q.settings }
        q.down()
        for(const key of ['dpr', 'msaa', 'bloom', 'far', 'traffic', 'crowd'])
            assert.ok(q.settings[key] <= previous[key], `${key} grew at step ${i}`)
    }
    assert.equal(q.tier, 'low')
    assert.equal(q.settings.msaa, 0)
    assert.equal(q.settings.bloom, 0)
})

test('Recovery requires three fast windows and never adds MSAA', () => {
    const q = new Quality({ tier: 'medium' })
    for(let i = 0; i < 90; i++) q.sample(12, 4000)
    assert.equal(q.tier, 'medium')
    for(let i = 0; i < 45; i++) q.sample(12, 6000)
    assert.equal(q.tier, 'high')
    assert.equal(q.settings.msaa, 0)
    const h = new Quality({ tier: 'high' })
    for(let i = 0; i < 30; i++) h.down()
    for(let i = 0; i < 30; i++) h.up()
    assert.equal(h.settings.msaa, 0)
})

test('Device density caps rendering; malformed tier gets a safe default', () => {
    const q = new Quality({ tier: 'high', deviceDpr: 1 })
    assert.equal(q.settings.dpr, 1)
    assert.equal(new Quality({ tier: 'broken' }).tier, 'medium')
})

test('Frame summary retains slow frames instead of using physics delta', () => {
    assert.equal(summarizeFrames([]), null)
    const result = summarizeFrames([10, 10, 10, 70])
    assert.equal(result.averageMs, 25)
    assert.equal(result.averageFps, 40)
    assert.equal(result.onePercentLow, 1000 / 70)
})

test('Time previews validate clock values and midnight is not falsy-missed', () => {
    assert.equal(previewTime('00:00'), 0)
    assert.equal(previewTime('13:00'), 13 / 24)
    assert.equal(previewTime('23:59'), (23 + 59 / 60) / 24)
    for(const value of ['24:00', '12:60', '-1:00', 'garbage', null])
        assert.equal(previewTime(value), null)
})

test('The visual slice stays at the existing crossroads coordinates', () => {
    assert.equal(inLookSlice(0, -30), true)
    assert.equal(inLookSlice(35, -30), true)
    assert.equal(inLookSlice(36, -30), false)
    assert.equal(inLookSlice(145, -29), false)
})
