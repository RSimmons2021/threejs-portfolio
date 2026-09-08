import * as THREE from 'three'

/**
 * Sky dome, sun, moon, stars and drifting clouds, all driven by
 * DayNightCycle.settings.currentTime (0 = midnight, 0.5 = noon) so the sky agrees
 * with the lighting the rest of the world already reacts to.
 *
 * Everything is drawn inside a dome that rides with the camera and writes no
 * depth, so it sits behind the city at any camera distance without needing the
 * far plane pushed out.
 */

// The camera's far plane is 120, so a bigger dome would be clipped away entirely
// even with depth testing off. Everything else is sized as a fraction of this.
const DOME_RADIUS = 96
const S = DOME_RADIUS / 300

// Keyed to the same moments DayNightCycle uses for its lighting schemes.
const STOPS = [
    { at: 0.00, horizon: '#1b2440', mid: '#101733', zenith: '#05070f' },
    { at: 0.20, horizon: '#3a3357', mid: '#1d2444', zenith: '#0a0f1f' },
    { at: 0.26, horizon: '#f2a06a', mid: '#7a6a9c', zenith: '#243560' },
    { at: 0.34, horizon: '#ffd9a8', mid: '#8fc0dd', zenith: '#3f7fc0' },
    { at: 0.50, horizon: '#cfe9f7', mid: '#7cc0e8', zenith: '#2f7bc4' },
    { at: 0.68, horizon: '#ffd5a3', mid: '#8bb6dc', zenith: '#3a72b4' },
    { at: 0.78, horizon: '#f08b5c', mid: '#6d5f96', zenith: '#1e2c55' },
    { at: 0.86, horizon: '#4a3a63', mid: '#22284a', zenith: '#0b1020' },
    { at: 1.00, horizon: '#1b2440', mid: '#101733', zenith: '#05070f' }
]

export default class Sky
{
    constructor(_options)
    {
        this.time = _options.time
        this.camera = _options.camera
        this.dayNightCycle = _options.dayNightCycle
        this.config = _options.config
        this.scene = _options.scene
        this.floor = _options.floor

        this.container = new THREE.Group()
        this.container.name = 'Sky / sun, moon, stars, clouds'
        this.container.renderOrder = - 10

        this.stops = STOPS.map((_stop) => ({
            at: _stop.at,
            horizon: new THREE.Color(_stop.horizon),
            mid: new THREE.Color(_stop.mid),
            zenith: new THREE.Color(_stop.zenith)
        }))

        this.setDome()
        this.setSun()
        this.setMoon()
        this.setStars()
        this.setClouds()

        this.time.on('tick', () => this.update())
    }

    // The sky of this world is painted by the floor shader: its quad is
    // NDC-sized and covers every ray above the horizon. That shader used to
    // hardcode one navy constant, so the sky never changed; these uniforms give
    // it the time-of-day ramp. Sun, moon, stars and clouds stay real meshes.
    setDome()
    {
        const uniforms = this.floor.material.uniforms
        this.gradient = {
            horizon: uniforms.uSkyHorizon.value,
            mid: uniforms.uSkyMid.value,
            zenith: uniforms.uSkyZenith.value
        }
        this.sunUniforms = uniforms
    }


    // Sun and moon are flat discs on the dome, drawn after it and still without
    // depth, so nothing in the city can ever occlude them.
    disc(_radius, _colour, _opacity = 1)
    {
        const mesh = new THREE.Mesh(
            new THREE.CircleGeometry(_radius, 32),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(_colour), transparent: true, opacity: _opacity, depthWrite: false, fog: false })
        )
        mesh.renderOrder = - 9
        mesh.frustumCulled = false
        return mesh
    }

    setSun()
    {
        this.sun = new THREE.Group()
        this.sun.add(this.disc(9 * S, '#fff3cf'))
        const halo = this.disc(22 * S, '#ffd489', 0.22)
        halo.renderOrder = - 9.5
        this.sun.add(halo)
        this.sunHalo = halo
        this.container.add(this.sun)
    }

    setMoon()
    {
        this.moon = new THREE.Group()
        this.moon.add(this.disc(6.5 * S, '#e9f0ff'))
        // A slightly offset dark disc carves the crescent without a texture.
        const shadow = this.disc(5.6 * S, '#0a0f1f', 1)
        shadow.position.set(2.9 * S, 1.4 * S, 0.4)
        shadow.renderOrder = - 8.9
        this.moon.add(shadow)
        const halo = this.disc(14 * S, '#9fb6e0', 0.14)
        halo.renderOrder = - 9.5
        this.moon.add(halo)
        this.moonHalo = halo
        this.container.add(this.moon)
    }

    setStars()
    {
        const count = this.config && this.config.touch ? 380 : 900
        const positions = new Float32Array(count * 3)
        const sizes = new Float32Array(count)

        for(let i = 0; i < count; i++)
        {
            // Upper hemisphere only, biased away from the horizon haze.
            const theta = Math.random() * Math.PI * 2
            const height = 0.12 + Math.random() * 0.88
            const ring = Math.sqrt(1 - height * height)
            const radius = DOME_RADIUS * 0.94
            positions[i * 3] = Math.cos(theta) * ring * radius
            positions[i * 3 + 1] = Math.sin(theta) * ring * radius
            positions[i * 3 + 2] = height * radius
            sizes[i] = 0.6 + Math.random() * 1.9
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))

        this.starMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uOpacity: { value: 0 },
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
            },
            vertexShader: /* glsl */`
                attribute float aSize;
                uniform float uPixelRatio;
                uniform float uTime;
                varying float vTwinkle;
                void main()
                {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    vTwinkle = 0.65 + 0.35 * sin(uTime * 1.6 + position.x * 0.35 + position.y * 0.21);
                    gl_PointSize = aSize * uPixelRatio * 2.0;
                }
            `,
            fragmentShader: /* glsl */`
                uniform float uOpacity;
                varying float vTwinkle;
                void main()
                {
                    float d = distance(gl_PointCoord, vec2(0.5));
                    float alpha = smoothstep(0.5, 0.1, d) * uOpacity * vTwinkle;
                    if(alpha < 0.01) discard;
                    gl_FragColor = vec4(1.0, 0.98, 0.92, alpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            fog: false
        })

        this.stars = new THREE.Points(geometry, this.starMaterial)
        this.stars.renderOrder = - 9.7
        this.stars.frustumCulled = false
        this.container.add(this.stars)
    }

    setClouds()
    {
        // Flat billboard puffs: cheap, and they read as the same paper-cut
        // language as the buildings rather than as volumetric fog.
        const texture = this.cloudTexture()
        this.clouds = []
        const count = this.config && this.config.touch ? 7 : 13

        for(let i = 0; i < count; i++)
        {
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.75, depthWrite: false, fog: false })
            const scale = (34 + Math.random() * 46) * S
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(scale, scale * 0.42), material)
            mesh.renderOrder = - 9.2
            mesh.frustumCulled = false
            const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5
            const height = 0.16 + Math.random() * 0.3
            mesh.userData = { angle, height, speed: 0.006 + Math.random() * 0.01, material }
            this.clouds.push(mesh)
            this.container.add(mesh)
        }
    }

    cloudTexture()
    {
        const canvas = document.createElement('canvas')
        canvas.width = 256
        canvas.height = 128
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#ffffff'
        // Overlapping discs with a soft edge: one puff silhouette, no noise.
        for(const [x, y, r] of [[80, 78, 34], [125, 66, 44], [172, 80, 30], [104, 86, 30], [148, 88, 28]])
        {
            const gradient = ctx.createRadialGradient(x, y, r * 0.35, x, y, r)
            gradient.addColorStop(0, 'rgba(255,255,255,1)')
            gradient.addColorStop(0.72, 'rgba(255,255,255,0.92)')
            gradient.addColorStop(1, 'rgba(255,255,255,0)')
            ctx.fillStyle = gradient
            ctx.beginPath()
            ctx.arc(x, y, r, 0, Math.PI * 2)
            ctx.fill()
        }
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        return texture
    }

    sample(_time)
    {
        const stops = this.stops
        let to = 1
        while(to < stops.length - 1 && stops[to].at < _time) to++
        const from = stops[to - 1]
        const next = stops[to]
        const span = Math.max(0.0001, next.at - from.at)
        const t = THREE.MathUtils.clamp((_time - from.at) / span, 0, 1)
        this.gradient.horizon.lerpColors(from.horizon, next.horizon, t)
        this.gradient.mid.lerpColors(from.mid, next.mid, t)
        this.gradient.zenith.lerpColors(from.zenith, next.zenith, t)
    }

    update()
    {
        const cycle = this.dayNightCycle
        const dayTime = cycle ? cycle.settings.currentTime : 0.5
        const night = cycle ? cycle.nightFactor : 0
        const elapsed = this.time.elapsed / 1000

        // Sun, moon, stars and clouds still ride with the camera so they stay at
        // a fixed apparent distance however far the car has driven.
        this.container.position.copy(this.camera.instance.position)

        this.sample(dayTime)

        // Sun rises in the east and sets in the west: one full turn per day, with
        // noon overhead. The moon is simply half a day out of phase.
        const sunAngle = (dayTime - 0.25) * Math.PI * 2
        const radius = DOME_RADIUS * 0.9
        const place = (_object, _angle) =>
        {
            const height = Math.sin(_angle)
            const across = Math.cos(_angle)
            _object.position.set(across * radius * 0.55, - across * radius * 0.35, height * radius)
            _object.lookAt(this.container.position)
        }

        place(this.sun, sunAngle)
        place(this.moon, sunAngle + Math.PI)

        const sunUp = Math.max(0, Math.sin(sunAngle))
        this.sun.visible = Math.sin(sunAngle) > - 0.12
        this.moon.visible = Math.sin(sunAngle + Math.PI) > - 0.12
        this.sunHalo.material.opacity = 0.1 + (1 - sunUp) * 0.28
        this.moonHalo.material.opacity = 0.08 + night * 0.12

        this.sunUniforms.uSunDirection.value.copy(this.sun.position).normalize()
        this.sunUniforms.uSunStrength.value = Math.max(0, 1 - night * 1.2)
        this.sunUniforms.uSunColor.value.copy(this.gradient.horizon)

        this.starMaterial.uniforms.uOpacity.value = Math.max(0, (night - 0.25) / 0.75)
        this.starMaterial.uniforms.uTime.value = elapsed
        this.stars.rotation.z = elapsed * 0.004

        // Clouds drift, and tint from white through sunset warmth into night blue.
        for(const cloud of this.clouds)
        {
            cloud.userData.angle += cloud.userData.speed * Math.min(this.time.delta / 1000, 0.05)
            const angle = cloud.userData.angle
            const height = cloud.userData.height
            const ring = Math.sqrt(Math.max(0, 1 - height * height))
            const r = DOME_RADIUS * 0.86
            cloud.position.set(Math.cos(angle) * ring * r, Math.sin(angle) * ring * r, height * r)
            cloud.lookAt(this.container.position)
            cloud.userData.material.color.copy(this.gradient.mid).lerp(new THREE.Color('#ffffff'), 0.55 - night * 0.35)
            cloud.userData.material.opacity = 0.68 - night * 0.32
        }
    }
}
