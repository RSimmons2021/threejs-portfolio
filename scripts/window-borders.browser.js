// GPU regression fixture for the actual city fragment shader. Run after entry.
// Uses tiny synthetic masks to isolate window-ID filtering from scene lighting.
// Run against the Vite dev URL; resolve its existing Three.js import (root=src).
(async () => {
    const module = await (await fetch('/javascript/World/CyberMaterials.js')).text()
    const importPath = module.match(/import \* as THREE from ["']([^"']+)["']/)?.[1]
    if(!importPath) throw new Error('Run the window fixture on the Vite dev site')
    const THREE = await import(importPath)
    const a = application, cyber = a.world.materials.cyber, renderer = a.renderer
    const source = a.world.neonCity.materials.nd_atlas
    const results = [], size = 16, pixels = new Uint8Array(128 * 128 * 4)
    const check = (label, value) => { if(!value) throw new Error(label); results.push(label) }
    const mask = new THREE.DataTexture(new Uint8Array(size * size * 4), size, size)
    mask.minFilter = mask.magFilter = THREE.LinearFilter
    mask.generateMipmaps = false; mask.flipY = false
    const atlas = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    atlas.needsUpdate = true
    const black = () => ({ value: new THREE.Color(0, 0, 0) })
    const material = new THREE.ShaderMaterial({
        vertexShader: source.vertexShader, fragmentShader: source.fragmentShader,
        defines: { KIT_ATLAS: 1 }, uniforms: {
            ...source.uniforms,
            uMask: { value: mask }, uAtlas: { value: atlas }, uAtlasSize: { value: new THREE.Vector2(size, size) },
            uSkyColor: black(), uGroundColor: black(), uSunColor: black(),
            uBounceScale: { value: 0 }, uSpotIntensity: { value: 0 }, uSpillCount: { value: 0 },
            uCarGlow: { value: new THREE.Vector4(0, 0, 0, 0) }, uFogDensity: { value: 0 },
            uDaylight: { value: 1 }, uLitFraction: { value: 0.13 }
        }
    })
    const geometry = new THREE.PlaneGeometry(2, 2)
    const scene = new THREE.Scene()
    scene.add(new THREE.Mesh(geometry, material))
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 3)
    camera.position.z = 2; camera.lookAt(0, 0, 0)
    const target = new THREE.WebGLRenderTarget(128, 128)
    const oldTarget = renderer.getRenderTarget()
    const color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha()
    const oldAutoClear = renderer.autoClear, wasRunning = a.time.running
    a.time.stop()
    const draw = id => {
        const data = mask.image.data
        for(let y = 0; y < size; y++) for(let x = 0; x < size; x++)
        {
            const i = (y * size + x) * 4
            const glass = x >= 4 && x < 12 && y >= 4 && y < 12
            data[i] = glass ? 255 : 0; data[i + 1] = glass ? id : 0
            data[i + 2] = 0; data[i + 3] = 255
        }
        mask.needsUpdate = true
        renderer.autoClear = true; renderer.setClearColor(0, 1)
        renderer.setRenderTarget(target); renderer.render(scene, camera)
        renderer.readRenderTargetPixels(target, 0, 0, 128, 128, pixels)
    }
    try
    {
        check('Window coverage is filtered smoothly', cyber.mask.magFilter === THREE.LinearFilter)
        // 177 / 255 is an unlit room. Its filtered border must not turn on.
        draw(177)
        const brightest = pixels.reduce((max, value, i) => i % 4 === 3 ? max : Math.max(max, value), 0)
        const centerPixel = [...pixels.subarray(((64 * 128) + 64) * 4, ((64 * 128) + 64) * 4 + 4)]
        check(`Unlit room has no illuminated border pixels (max=${brightest}, center=${centerPixel})`, brightest === 0)
        // 73 / 255 is a lit room: every edge must stay the same hue, scaled by
        // coverage, rather than inventing other rooms or brighter edge values.
        draw(73)
        const center = ((64 * 128) + 64) * 4
        const rgb = [...pixels.subarray(center, center + 3)]
        check('Lit window interior remains visible', rgb[0] > 20 && rgb[1] > 20)
        let stable = true
        for(let i = 0; i < pixels.length; i += 4)
            for(let channel = 0; channel < 3; channel++)
            {
                if(pixels[i + channel] > rgb[channel] + 1) stable = false
                if(pixels[i] > 10 && Math.abs(pixels[i + channel] - pixels[i] * rgb[channel] / rgb[0]) > 2) stable = false
            }
        check('Lit borders keep the interior hue and never outshine it', stable)
        material.uniforms.uAtlasSize.value.set(1024, 1024)
        draw(177)
        const distant = pixels.slice()
        draw(73)
        check('Sub-pixel rooms blend to stable average light energy',
            distant.some((value, i) => i % 4 !== 3 && value > 0) && pixels.every((value, i) => value === distant[i]))
        return results
    }
    finally
    {
        renderer.setRenderTarget(oldTarget); renderer.setClearColor(color, alpha); renderer.autoClear = oldAutoClear
        target.dispose(); mask.dispose(); atlas.dispose(); material.dispose(); geometry.dispose()
        if(wasRunning) a.time.resume()
    }
})()
