import * as THREE from 'three'
import CANNON from 'cannon'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// The whole Neon District, built from static/models/cyber/district-layout.json.
// Each module is one InstancedMesh per material and LOD for the whole district
// (about 70 draws). Every 100 ms the CPU repacks the instance buffers with only
// the instances inside the camera frustum: full detail (LOD0) within NEAR metres,
// LOD1 beyond. Greebles disappear at distance. The skyline ring is one global
// instanced draw per tower variant.
const NEAR = 50
const GREEBLE_FAR = 80
const PROJECT_ACCENTS = ['#bce685', '#71e0f4', '#a6baff', '#f8b984', '#c9b6ff', '#f8d665']
const NEON_TINTS = ['#ff2bd6', '#22e5ff', '#9dff3a', '#ffb02e', '#a77bff', '#58b6ff']
const GREEBLES = /^(ac_cluster|pipe_run|fire_escape|scaffold|neon_tube|sign_blade|sign_box|clutter_boxes|steam_vent|bollard|vending|dumpster)$/
const PROP_COLLIDERS = { street_lamp: [0.25, 0.25, 6], vending: [0.9, 0.75, 1.95], dumpster: [1.8, 1.1, 1.3], bollard: [0.26, 0.26, 0.9] }

const hashSeed = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s) }

export default class NeonCity
{
    constructor(world)
    {
        this.world = world
        this.layout = world.resources.items.cyberLayout
        this.container = new THREE.Group()
        this.container.name = 'Neon District'
        this.bodies = []
        this.colliders = []
        this.transform = new THREE.Object3D()
        this.lastUpdate = -Infinity
        this.settings = world.quality.settings
        this.readKit()
        this.buildModules()
        this.buildSkyline()
        this.buildSigns()
        this.buildBeams()
        this.buildCollision()
        world.time.on('tick', () => this.update())
    }

    // kit node -> [{ geometry, slot }] with the node transform baked in
    readKit()
    {
        const kit = this.world.resources.items.cyberKit.scene
        kit.updateMatrixWorld(true)
        this.kit = new Map()
        for(const node of kit.children)
        {
            const parts = []
            node.traverse(source =>
            {
                if(!source.isMesh) return
                const geometry = this.normalise(source.geometry.clone().applyMatrix4(source.matrixWorld))
                parts.push({ geometry, slot: source.material.name })
            })
            if(parts.length) this.kit.set(node.name, parts)
        }
        const m = this.world.materials.cyber
        this.materials = {
            nd_atlas: m.create({ atlas: true, ao: true, seed: true }),
            nd_glass: m.create({ color: new THREE.Color('#5d8f9c'), ao: true, alpha: 0.32 }),
            nd_screen: m.create({ screen: true, tinted: true, seed: true }),
            far: m.create({ atlas: true, ao: true, seed: true })
        }
    }

    // Every kit primitive gets the same attribute layout so geometries merge.
    normalise(geometry)
    {
        const g = geometry.index ? geometry.toNonIndexed() : geometry
        const count = g.attributes.position.count
        const out = new THREE.BufferGeometry()
        out.setAttribute('position', g.attributes.position)
        out.setAttribute('normal', g.attributes.normal || new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3))
        out.setAttribute('uv', g.attributes.uv || new THREE.Float32BufferAttribute(new Float32Array(count * 2), 2))
        const ao = new Float32Array(count * 4).fill(1)
        const src = g.attributes.color
        if(src) for(let i = 0; i < count; i++) ao[i * 4] = src.getX(i)
        out.setAttribute('color', new THREE.Float32BufferAttribute(ao, 4))
        return out
    }

    tintFor(module, p)
    {
        if(module === 'billboard_wall' || module === 'crown_billboard')
        {
            const hero = this.layout.heroBillboards.find(h => Math.abs(h.p[0] - p[0]) < 1 && Math.abs(h.p[1] - p[1]) < 1)
            if(hero) return new THREE.Color(hero.project !== undefined ? PROJECT_ACCENTS[hero.project] : '#22e5ff')
        }
        return new THREE.Color(NEON_TINTS[Math.floor(hashSeed(p[0], p[1], p[2]) * NEON_TINTS.length)])
    }

    // One InstancedMesh per module/material/LOD for the whole district. Every
    // update the CPU repacks each mesh's instance buffers with only the
    // instances that are in the camera frustum and in that LOD's distance band.
    buildModules()
    {
        this.modules = []
        for(const [module, placements] of Object.entries(this.layout.instances))
        {
            if(module.startsWith('skyline_')) continue
            const near = this.kit.get(`kit_${module}_lod0`)
            if(!near) continue
            const far = this.kit.get(`kit_${module}_lod1`)
            const n = placements.length
            const matrices = new Float32Array(n * 16), seeds = new Float32Array(n), tints = new Float32Array(n * 3)
            const centers = new Float32Array(n * 3), radii = new Float32Array(n)
            const bounds = new THREE.Box3()
            for(const { geometry } of near) { geometry.computeBoundingBox(); bounds.union(geometry.boundingBox) }
            const localCenter = bounds.getCenter(new THREE.Vector3()), localRadius = bounds.getSize(new THREE.Vector3()).length() / 2
            placements.forEach((p, i) =>
            {
                this.transform.position.set(p[0], p[1], p[2])
                this.transform.rotation.set(0, 0, p[3])
                this.transform.scale.set(p[4], p[5], p[6])
                this.transform.updateMatrix()
                this.transform.matrix.toArray(matrices, i * 16)
                localCenter.clone().applyMatrix4(this.transform.matrix).toArray(centers, i * 3)
                radii[i] = localRadius * Math.max(p[4], p[5], p[6])
                seeds[i] = hashSeed(p[0], p[1], p[2])
                this.tintFor(module, p).toArray(tints, i * 3)
            })
            const entry = { module, n, matrices, seeds, tints, centers, radii, near: [], far: [],
                limit: GREEBLES.test(module) ? GREEBLE_FAR : Infinity, hasFar: !!far,
                nearPicks: new Uint32Array(n), farPicks: new Uint32Array(n) }
            const makeMeshes = (parts, list) =>
            {
                for(const { geometry, slot } of parts)
                {
                    if(slot === 'nd_sign') continue
                    const g = geometry.clone()
                    const seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1)
                    const tintAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)
                    seedAttr.setUsage(THREE.DynamicDrawUsage); tintAttr.setUsage(THREE.DynamicDrawUsage)
                    g.setAttribute('aSeed', seedAttr)
                    g.setAttribute('aTint', tintAttr)
                    const material = this.materials[slot] || this.materials.nd_atlas
                    const mesh = new THREE.InstancedMesh(g, material, n)
                    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
                    mesh.count = 0
                    mesh.frustumCulled = false
                    mesh.name = `${module}/${slot}`
                    if(slot === 'nd_glass') mesh.renderOrder = 2
                    this.container.add(mesh)
                    list.push(mesh)
                }
            }
            makeMeshes(near, entry.near)
            if(far) makeMeshes(far, entry.far)
            this.modules.push(entry)
        }
        this.frustum = new THREE.Frustum()
        this.projScreen = new THREE.Matrix4()
        this.sphere = new THREE.Sphere()
    }

    // Copy the chosen instances into each mesh's buffers.
    pack(entry, meshes, picks, count)
    {
        for(const mesh of meshes)
        {
            const m = mesh.instanceMatrix.array, s = mesh.geometry.attributes.aSeed, t = mesh.geometry.attributes.aTint
            for(let k = 0; k < count; k++)
            {
                const i = picks[k]
                m.set(entry.matrices.subarray(i * 16, i * 16 + 16), k * 16)
                s.array[k] = entry.seeds[i]
                t.array[k * 3] = entry.tints[i * 3]; t.array[k * 3 + 1] = entry.tints[i * 3 + 1]; t.array[k * 3 + 2] = entry.tints[i * 3 + 2]
            }
            mesh.count = count
            mesh.instanceMatrix.needsUpdate = true
            s.needsUpdate = true
            t.needsUpdate = true
        }
    }

    buildSkyline()
    {
        this.skyline = new THREE.Group()
        for(const [module, placements] of Object.entries(this.layout.instances))
        {
            if(!module.startsWith('skyline_')) continue
            for(const { geometry, slot } of this.kit.get(`kit_${module}_lod0`) || [])
            {
                const g = geometry.clone()
                g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(placements.map(p => hashSeed(p[0], p[1], 7))), 1))
                const mesh = new THREE.InstancedMesh(g, this.materials.nd_atlas, placements.length)
                placements.forEach((p, i) =>
                {
                    this.transform.position.set(p[0], p[1], p[2]); this.transform.rotation.set(0, 0, p[3]); this.transform.scale.set(p[4], p[5], p[6])
                    this.transform.updateMatrix(); mesh.setMatrixAt(i, this.transform.matrix)
                })
                mesh.computeBoundingSphere()
                this.skyline.add(mesh)
            }
        }
        this.container.add(this.skyline)
    }

    buildSigns()
    {
        const designs = this.world.resources.items.cyberSigns.designs
        const texture = this.world.resources.items.cyber_signs_colorTexture
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
        const material = this.world.materials.cyber.create({ sign: true, seed: true })
        material.uniforms = { ...material.uniforms, uAtlas: { value: texture } }
        this.signs = new THREE.Group()
        const groups = new Map()
        for(const s of this.layout.signSlots)
        {
            const module = s.module || 'flat'
            if(module === 'crown_billboard') continue
            if(!groups.has(module)) groups.set(module, [])
            groups.get(module).push(s)
        }
        for(const [module, slots] of groups)
        {
            let geometry
            if(module === 'flat') geometry = this.normalise(new THREE.PlaneGeometry(1, 1).rotateX(Math.PI / 2))
            else
            {
                const part = this.kit.get(`kit_${module}_lod0`)?.find(p => p.slot === 'nd_sign')
                if(part) geometry = part.geometry.clone()
            }
            if(!geometry) continue
            // Kit sign faces are authored uv 0..1 in glTF (top-left) space; the sign atlas rects are
            // bottom-left. PlaneGeometry is already bottom-left.
            if(module !== 'flat')
            {
                const uv = geometry.attributes.uv
                for(let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
            }
            geometry.setAttribute('aRect', new THREE.InstancedBufferAttribute(new Float32Array(slots.flatMap(s => designs[s.design % designs.length].uv)), 4))
            geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(slots.map((s, i) => (i * 0.618) % 1)), 1))
            const mesh = new THREE.InstancedMesh(geometry, material, slots.length)
            slots.forEach((s, i) =>
            {
                this.transform.position.set(...s.p)
                this.transform.rotation.set(0, 0, s.rotZ || 0)
                this.transform.scale.set(module === 'flat' ? s.w : 1, 1, module === 'flat' ? s.h : 1)
                this.transform.updateMatrix()
                mesh.setMatrixAt(i, this.transform.matrix)
            })
            mesh.computeBoundingSphere()
            mesh.name = `signs/${module}`
            this.signs.add(mesh)
        }
        this.container.add(this.signs)
    }

    buildBeams()
    {
        this.beamAnchors = this.layout.beams.map(b => ({ p: new THREE.Vector3(...b.p), dir: new THREE.Vector3(...b.dir).normalize() }))
        const length = 11
        const geometry = new THREE.ConeGeometry(2.4, length, 16, 1, true).translate(0, -length / 2, 0).rotateX(Math.PI / 2)
        this.beamMaterial = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
            uniforms: { uIntensity: { value: 0.12 }, uColor: { value: new THREE.Color('#cfe2ff') }, uFogDensity: this.world.materials.cyber.shared.uFogDensity },
            vertexShader: `varying float vT; varying vec3 vN; varying vec3 vW;
                void main(){ vT = clamp(-position.z / ${length.toFixed(1)}, 0.0, 1.0); vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
                vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
            fragmentShader: `uniform float uIntensity; uniform vec3 uColor; uniform float uFogDensity; varying float vT; varying vec3 vN; varying vec3 vW;
                void main(){ vec3 v = normalize(cameraPosition - vW); float edge = pow(abs(dot(normalize(vN), v)), 1.6);
                float fall = pow(1.0 - vT, 1.4) * smoothstep(0.0, 0.08, vT);
                float d = distance(cameraPosition, vW); float fog = exp(-d * uFogDensity * 0.7);
                gl_FragColor = vec4(uColor * edge * fall * uIntensity * fog, 1.0); }`
        })
        this.beams = new THREE.InstancedMesh(geometry, this.beamMaterial, 64)
        this.beams.frustumCulled = false
        this.beams.count = 0
        this.beams.renderOrder = 3
        this.container.add(this.beams)
        this.down = new THREE.Vector3(0, 0, -1)
        this.quat = new THREE.Quaternion()
    }

    addBox(center, size, rotation = 0, role = 'neon-building')
    {
        const body = new CANNON.Body({ mass: 0 })
        body.addShape(new CANNON.Box(new CANNON.Vec3(size[0] / 2, size[1] / 2, size[2] / 2)))
        body.position.set(...center)
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), rotation)
        body.collisionRole = role
        this.world.physics.world.addBody(body)
        this.bodies.push(body)
        const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation))
        const hx = (size[0] * c + size[1] * s) / 2, hy = (size[0] * s + size[1] * c) / 2
        this.colliders.push(new THREE.Box3(new THREE.Vector3(center[0] - hx, center[1] - hy, center[2] - size[2] / 2),
            new THREE.Vector3(center[0] + hx, center[1] + hy, center[2] + size[2] / 2)))
    }

    buildCollision()
    {
        for(const t of this.layout.towers) this.addBox(t.collision.center, t.collision.size)
        for(const b of this.layout.skybridges)
            this.addBox([b.center[0], b.center[1], b.center[2] + b.collision.offsetZ], b.collision.size, b.rotZ)
        for(const p of this.layout.pads)
            this.addBox([p.center[0], p.center[1], p.deckZ - 0.25], [12, 12, 0.5], p.rotZ, 'neon-pad')
        for(const [module, size] of Object.entries(PROP_COLLIDERS))
            for(const p of this.layout.instances[module] || [])
                this.addBox([p[0], p[1], p[2] + size[2] / 2], size, p[3], 'neon-prop')
    }

    setQuality(settings)
    {
        this.settings = settings
        this.lastUpdate = -Infinity
    }

    update()
    {
        const w = this.world
        const camera = w.camera.instance.position
        if(w.time.elapsed - this.lastUpdate > 100)
        {
            this.lastUpdate = w.time.elapsed
            const far = Math.max(this.settings.far, 160) + 60
            const cam = w.camera.instance
            this.projScreen.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
            this.frustum.setFromProjectionMatrix(this.projScreen)
            for(const e of this.modules)
            {
                let nn = 0, nf = 0
                const limit = Math.min(e.limit, far)
                for(let i = 0; i < e.n; i++)
                {
                    const cx = e.centers[i * 3], cy = e.centers[i * 3 + 1], cz = e.centers[i * 3 + 2]
                    const d = Math.hypot(cx - camera.x, cy - camera.y, cz - camera.z) - e.radii[i]
                    if(d > limit) continue
                    this.sphere.center.set(cx, cy, cz); this.sphere.radius = e.radii[i] + 12
                    if(!this.frustum.intersectsSphere(this.sphere)) continue
                    if(d < NEAR || !e.hasFar) e.nearPicks[nn++] = i
                    else e.farPicks[nf++] = i
                }
                this.pack(e, e.near, e.nearPicks, nn)
                if(e.hasFar) this.pack(e, e.far, e.farPicks, nf)
            }
            // Light beams: the nearest anchors in front of the camera.
            const forward = new THREE.Vector3(); w.camera.instance.getWorldDirection(forward)
            const scored = []
            for(const b of this.beamAnchors)
            {
                const dx = b.p.x - camera.x, dy = b.p.y - camera.y, dz = b.p.z - camera.z
                const d = Math.hypot(dx, dy, dz)
                if(d > 120) continue
                const ahead = (dx * forward.x + dy * forward.y + dz * forward.z) / Math.max(d, 1)
                if(ahead < -0.2 && d > 12) continue
                scored.push([d - ahead * 20, b])
            }
            scored.sort((a, b) => a[0] - b[0])
            const n = Math.min(scored.length, this.settings.beams, 64)
            for(let i = 0; i < n; i++)
            {
                const b = scored[i][1]
                this.quat.setFromUnitVectors(this.down, b.dir)
                this.transform.position.copy(b.p)
                this.transform.quaternion.copy(this.quat)
                this.transform.scale.set(1, 1, 1)
                this.transform.updateMatrix()
                this.beams.setMatrixAt(i, this.transform.matrix)
            }
            this.beams.count = n
            this.beams.instanceMatrix.needsUpdate = true
        }
        const cyber = w.materials.cyber
        this.beamMaterial.uniforms.uIntensity.value = 0.05 + (1 - cyber.daylight) * 0.14
    }
}
