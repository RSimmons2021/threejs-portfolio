import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { megacityProfile } from './megacityProfile.js'
import MegacityCollision from './MegacityCollision.js'
import { MEGACITY_CEILING } from './flightRules.js'

// Unity's Megacity (2019) around the Neon District: the original modular city,
// its PBR materials and HDR sky, cut open where the district stands. Built by
// scripts/megacity/build_ring.py into static/models/megacity/.
//
// Placements are bucketed into 50 m cells once. A few times a second the cells
// in view are copied into one InstancedMesh per model and LOD, the LOD picked
// from the cell's distance. Nothing here may break the portfolio: if loading
// fails the district simply keeps its own skyline.
const BASE = './models/megacity/'
const CELL = 50
const LODS = ['near', 'far', 'distant']
const PLACEMENT_BYTES = 30

// 50 m cubes: a column cell would span a whole 450 m block and look "near"
// from anywhere beside it.
export function cellKey(x, y, z)
{
    return `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`
}

// LOD distances scale with the object: a 1 m air conditioner (6k triangles at
// full detail) drops to its 24-vertex proxy long before a 50 m wall tile does.
export function pickLod(distance, size, near, far)
{
    const scale = Math.min(1, Math.max(0.15, size / 25))
    return distance < near * scale ? 0 : distance < far * Math.max(scale, 0.25) ? 1 : 2
}

// Decode one ring-<n>.bin: u16 model, u16 flags, f32 xyz, i16 quaternion, f16 scale.
export function decodePlacements(buffer, matrix = new THREE.Matrix4(), onPlacement)
{
    const view = new DataView(buffer)
    const count = buffer.byteLength / PLACEMENT_BYTES
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3()
    for(let i = 0; i < count; i++)
    {
        const o = i * PLACEMENT_BYTES
        p.set(view.getFloat32(o + 4, true), view.getFloat32(o + 8, true), view.getFloat32(o + 12, true))
        q.set(view.getInt16(o + 16, true) / 32767, view.getInt16(o + 18, true) / 32767,
            view.getInt16(o + 20, true) / 32767, view.getInt16(o + 22, true) / 32767).normalize()
        s.set(THREE.DataUtils.fromHalfFloat(view.getUint16(o + 24, true)), THREE.DataUtils.fromHalfFloat(view.getUint16(o + 26, true)),
            THREE.DataUtils.fromHalfFloat(view.getUint16(o + 28, true)))
        matrix.compose(p, q, s)
        onPlacement(view.getUint16(o, true), matrix, p)
    }
    return count
}

// Draw-call budget: ~60 facade tile variants share one material, and many have
// no LOD chain (1-2.5k vertices at every level). Past the near range every
// variant of a family is drawn with one cheap proxy (the family's 4- or 8-vertex
// textured LOD), so the whole family becomes a single instanced draw. All tiles
// share a pivot (bottom-left on the wall plane), so proxies line up exactly.
// Half-height families reuse the tall proxy cropped to 25 m, UVs included.
export const TILE_PROXIES = [
    { family: /^Building_Tile_(Bare_)?2500x5000/, proxy: 'Building_Tile_2500x5000_A' },
    { family: /^Building_Tile_(Bare_)?1250x5000/, proxy: 'Building_Tile_1250x5000_A' },
    { family: /^Building_Tile_(Bare_)?2500x2500/, proxy: 'Building_Tile_2500x5000_A', crop: 0.5 },
    { family: /^Building_Tile_(Bare_)?1250x2500/, proxy: 'Building_Tile_1250x5000_A', crop: 0.5 },
    { family: /^Building_Tile_Corner_(Bare_)?2500x5000/, proxy: 'Building_Tile_Corner_2500x5000_A' },
    { family: /^Building_Tile_Corner_(Bare_)?2500x2500/, proxy: 'Building_Tile_Corner_2500x5000_A', crop: 0.5 }
]
const PROXY_FAR_VERTICES = 200

// Crop a wall proxy to a fraction of its height. Each top vertex moves down and
// takes the UV interpolated toward the bottom vertex below it, so the facade
// texture keeps its scale instead of being squashed.
export function cropProxy(geometry, ratio)
{
    const g = geometry.clone()
    const p = g.attributes.position, uv = g.attributes.uv
    let top = -Infinity
    for(let i = 0; i < p.count; i++) top = Math.max(top, p.getZ(i))
    const bottom = []
    for(let i = 0; i < p.count; i++) if(p.getZ(i) < top * 0.5) bottom.push(i)
    const across = (i, j) => Math.hypot(p.getX(j) - p.getX(i), p.getY(j) - p.getY(i))
    for(let i = 0; i < p.count; i++)
    {
        const z = p.getZ(i)
        if(z < top * 0.5 || !bottom.length) continue
        const below = bottom.reduce((best, j) => across(i, j) < across(i, best) ? j : best, bottom[0])
        const z0 = p.getZ(below)
        p.setZ(i, z0 + (z - z0) * ratio)
        if(uv) uv.setXY(i, uv.getX(below) + (uv.getX(i) - uv.getX(below)) * ratio, uv.getY(below) + (uv.getY(i) - uv.getY(below)) * ratio)
    }
    p.needsUpdate = true
    if(uv) uv.needsUpdate = true
    g.computeBoundingSphere()
    return g
}

export default class MegacityRing
{
    constructor(world)
    {
        this.world = world
        this.container = new THREE.Group()
        this.container.name = 'Megacity ring'
        // ?megacity=0 keeps the district's own skyline (comparisons, weak devices).
        const disabled = new URLSearchParams(location.search).get('megacity') === '0'
        this.profile = disabled ? null : megacityProfile(world.quality.tier, { mobile: !!world.config.mobile })
        this.profileTier = world.quality.tier
        this.reach = 1
        this.ready = false
        this.cells = new Map()
        this.meshes = []
        this.lastPack = -Infinity
        this.lastCamera = new THREE.Vector3(Infinity, 0, 0)
        this.lastForward = new THREE.Vector3()
        this.frustum = new THREE.Frustum()
        this.projection = new THREE.Matrix4()
        this.sphere = new THREE.Sphere()
        this.forward = new THREE.Vector3()
        // uRingCanyon: how much the height-based canyon darkening also dims the
        // sun (1 with no shadow map, 0.35 when the real shadows do the work).
        this.uniforms = { uRingEmissive: { value: 1 }, uRingCanyon: { value: 1 } }
        if(!this.profile) return
        this.load().catch(error => console.warn('Megacity ring unavailable; keeping the district skyline.', error))
    }

    async load()
    {
        const started = performance.now()
        const manifest = await (await fetch(BASE + 'ring.json')).json()
        this.manifest = manifest
        const bands = manifest.bands.slice(0, this.profile.bands)
        const buffers = await Promise.all(bands.map(async band =>
        {
            const response = await fetch(BASE + band.url)
            if(!response.ok) throw new Error(`Megacity placements missing: ${band.url}`)
            return response.arrayBuffer()
        }))
        const skip = this.profile.skip
        const used = new Set(bands.flatMap(band => band.models).filter(id => !skip?.test(manifest.models[id].name)))
        const collision = manifest.collision ? fetch(BASE + manifest.collision.url).then(r => r.ok ? r.arrayBuffer() : null) : null
        const models = await this.loadModels(manifest, used)
        this.buildCells(manifest, buffers, models)
        const heights = await collision
        if(heights) this.setupCollision(manifest, heights)
        this.ready = true
        // The ring replaces the district's procedural skyline and needs a longer view.
        this.cameraFar = this.profile.cameraFar
        const camera = this.world.camera.instance
        camera.far = this.cameraFar
        camera.updateProjectionMatrix()
        if(this.world.neonCity?.skyline) this.world.neonCity.skyline.visible = false
        if(this.profile.shadow) this.setupShadow()
        console.info('megacity-ring', JSON.stringify({ tier: this.world.quality.tier, bands: this.profile.bands,
            placements: this.placements, models: this.models.size, cells: this.cells.size, meshes: this.meshes.length,
            ms: Math.round(performance.now() - started) }))
    }

    async loadModels(manifest, used)
    {
        const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
        const materials = new Map()
        const material = (guid) =>
        {
            if(!materials.has(guid)) materials.set(guid, this.createMaterial(manifest, guid))
            return materials.get(guid)
        }
        const ids = [...used]
        const models = new Map()
        let cursor = 0
        // Four at a time: decoding every model in the same frame stalls the page.
        await Promise.all(Array.from({ length: 4 }, async () =>
        {
            while(cursor < ids.length)
            {
                const id = ids[cursor++]
                const entry = manifest.models[id]
                const gltf = await loader.loadAsync(BASE + entry.url)
                gltf.scene.updateMatrixWorld(true)
                const lods = {}
                for(const level of LODS)
                {
                    const parts = []
                    gltf.scene.getObjectByName(level)?.traverse(node =>
                    {
                        if(!node.isMesh) return
                        // Bake the FBX root and node transforms, and de-quantise so the
                        // instanced geometry is plain float data.
                        const geometry = node.geometry.clone()
                        for(const name of ['position', 'normal'])
                        {
                            const source = geometry.getAttribute(name)
                            if(!source) continue
                            const array = new Float32Array(source.count * source.itemSize)
                            for(let i = 0; i < source.count; i++)
                                for(let k = 0; k < source.itemSize; k++) array[i * source.itemSize + k] = source.getComponent(i, k)
                            geometry.setAttribute(name, new THREE.Float32BufferAttribute(array, source.itemSize))
                        }
                        geometry.applyMatrix4(node.matrixWorld)
                        parts.push({ geometry, material: material(node.material.name) })
                    })
                    if(parts.length) lods[level] = parts
                }
                models.set(id, { ...entry, lods })
            }
        }))
        return models
    }

    createMaterial(manifest, guid)
    {
        const source = manifest.materials[guid]
        const shared = this.world.materials.cyber.shared
        if(!source) return new THREE.MeshStandardMaterial({ color: 0x5b605c, roughness: 0.9 })
        const px = String(this.profile.texture)
        const loader = this.textureLoader ||= new THREE.TextureLoader()
        const texture = (role, srgb) =>
        {
            const ref = source.textures[role]
            const url = ref && manifest.textures[ref.id]?.[role]?.[px]
            if(!url) return null
            const map = loader.load(BASE + url)
            map.wrapS = map.wrapT = THREE.RepeatWrapping
            map.anisotropy = this.profile.texture >= 1024 ? 4 : 1
            map.repeat.set(ref.scale[0], ref.scale[1])
            map.offset.set(ref.offset[0], ref.offset[1])
            map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
            return map
        }
        const f = source.floats, c = source.colors
        const base = c._BaseColor ?? c._Color ?? { r: 1, g: 1, b: 1, a: 1 }
        const m = new THREE.MeshStandardMaterial({ name: source.name, color: new THREE.Color(base.r, base.g, base.b),
            roughness: 1 - (f._Smoothness ?? 0.4), metalness: f._Metallic ?? 0 })
        m.map = texture('map', true)
        if(this.profile.normalMaps)
        {
            m.normalMap = texture('normal', false)
            if(m.normalMap) m.normalScale.setScalar(f._NormalScale ?? 1)
        }
        // HDRP mask map was repacked as ORM (occlusion R, roughness G, metallic B).
        const orm = texture('orm', false)
        if(orm)
        {
            m.aoMap = orm; m.roughnessMap = orm; m.metalnessMap = orm
            m.roughness = 1; m.metalness = 1; m.aoMapIntensity = 0.9
        }
        const emissive = texture('emissive', true)
        if(emissive)
        {
            m.emissiveMap = emissive
            const e = c._EmissiveColor ?? c._EmissionColor ?? { r: 1, g: 1, b: 1 }
            m.emissive.setRGB(e.r, e.g, e.b)
            const peak = Math.max(e.r, e.g, e.b)
            if(peak > 4) m.emissive.multiplyScalar(4 / peak)
        }
        if(f._AlphaCutoffEnable === 1 || f._AlphaClip === 1) m.alphaTest = f._AlphaCutoff ?? 0.4
        // Mirrored placements (negative X scale) reverse triangle winding, and an
        // InstancedMesh cannot flip culling per instance: draw both sides.
        m.side = THREE.DoubleSide
        // Same height/distance haze as the district shader (CyberMaterials), and
        // window emission that follows the clock.
        m.onBeforeCompile = (shader) =>
        {
            Object.assign(shader.uniforms, { uFogColor: shared.uFogColor, uFogHighColor: shared.uFogHighColor,
                uFogDensity: shared.uFogDensity, uFogHeight: shared.uFogHeight, uDaylight: shared.uDaylight,
                uRingEmissive: this.uniforms.uRingEmissive, uRingCanyon: this.uniforms.uRingCanyon })
            shader.vertexShader = 'varying vec3 vRingWorld;\n' + shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
                vec4 ringWorld = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    ringWorld = instanceMatrix * ringWorld;
                #endif
                vRingWorld = (modelMatrix * ringWorld).xyz;`)
            shader.fragmentShader = `varying vec3 vRingWorld;
                uniform vec3 uFogColor; uniform vec3 uFogHighColor; uniform float uFogDensity; uniform float uFogHeight;
                uniform float uDaylight; uniform float uRingEmissive; uniform float uRingCanyon;\n` + shader.fragmentShader
                // Megacity's streets sink into shade: sky light falls off toward
                // the canyon floor (and the sun too, where no shadow map exists).
                .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
                    float canyon = mix(0.28, 1.0, smoothstep(-30.0, 260.0, vRingWorld.z));
                    // Shaded facades keep some sky light so their detail still reads.
                    reflectedLight.indirectDiffuse *= mix(0.5, 1.0, canyon);
                    reflectedLight.indirectSpecular *= canyon;
                    reflectedLight.directDiffuse *= mix(1.0, canyon, uRingCanyon);
                    reflectedLight.directSpecular *= mix(1.0, canyon, uRingCanyon);`)
                .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= uRingEmissive;')
                .replace('#include <fog_fragment>', `
                    {
                        float d = distance(cameraPosition, vRingWorld);
                        float eye = max(cameraPosition.z, 0.0) / uFogHeight;
                        float end = max(vRingWorld.z, 0.0) / uFogHeight;
                        float dz = end - eye;
                        float heightK = abs(dz) < 0.01 ? exp(-eye) : (exp(-eye) - exp(-end)) / dz;
                        float density = uFogDensity * (0.6 + 1.2 * heightK);
                        float fog = 1.0 - exp(-pow(d * density, 2.0) - d * uFogDensity * mix(0.55, 0.25, uDaylight));
                        vec3 fogColor = mix(uFogColor, uFogHighColor, smoothstep(2.0, 85.0, (vRingWorld.z + cameraPosition.z) * 0.5));
                        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(fog, 0.0, 0.985));
                    }`)
        }
        return m
    }

    buildCells(manifest, buffers, models)
    {
        // Dev only: ?ringHide=Laundry,Trash drops model families for look checks.
        const hide = import.meta.env.DEV ? (new URLSearchParams(location.search).get('ringHide') || '').split(',').filter(Boolean) : []
        if(hide.length) for(const [id, model] of models) if(hide.some(prefix => model.name.startsWith(prefix))) models.delete(id)
        // Count placements per model first so each InstancedMesh is sized once.
        const counts = new Map()
        const list = []
        const matrix = new THREE.Matrix4()
        for(const buffer of buffers)
            decodePlacements(buffer, matrix, (model, m, p) =>
            {
                if(!models.has(model)) return
                counts.set(model, (counts.get(model) || 0) + 1)
                list.push(model, p.x, p.y, p.z, ...m.elements)
            })
        // Per model and LOD: one InstancedMesh per material part, all sharing one
        // instance-matrix buffer so a repack uploads it once.
        this.models = new Map()
        for(const [id, model] of models)
        {
            model.name ||= manifest.models[id].name
            const capacity = counts.get(id) || 0
            if(!capacity) continue
            const lods = LODS.map(level => model.lods[level] || model.lods.far || model.lods.near || model.lods.distant)
            const entry = { size: model.size, levels: [] }
            for(const parts of lods)
            {
                const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16)
                attribute.setUsage(THREE.DynamicDrawUsage)
                const meshes = parts.map(part =>
                {
                    const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity)
                    mesh.instanceMatrix = attribute
                    mesh.count = 0
                    mesh.frustumCulled = false
                    mesh.matrixAutoUpdate = false
                    mesh.userData.model = `${model.name}:${['near', 'far', 'distant'][entry.levels.length]}`
                    mesh.castShadow = !!this.profile.shadow
                    mesh.receiveShadow = !!this.profile.shadow
                    this.container.add(mesh)
                    this.meshes.push(mesh)
                    return mesh
                })
                entry.levels.push({ attribute, meshes, count: 0 })
            }
            this.models.set(id, entry)
        }
        this.setupProxies(models, counts)

        // Bucket by the world centre of each placement's bounds. Each run (one
        // model inside one cell) keeps its own sphere for LOD and culling.
        const stride = 4 + 16
        const staging = new Map()
        const local = new THREE.Vector3(), world = new THREE.Vector3(), m = new THREE.Matrix4()
        const empty = () => ({ min: new THREE.Vector3(Infinity, Infinity, Infinity), max: new THREE.Vector3(-Infinity, -Infinity, -Infinity) })
        for(let i = 0; i < list.length; i += stride)
        {
            const model = list[i]
            if(!this.models.has(model)) continue
            const b = manifest.models[model].bounds
            m.fromArray(list, i + 4)
            world.copy(local.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2)).applyMatrix4(m)
            const key = cellKey(world.x, world.y, world.z)
            let cell = staging.get(key)
            if(!cell) staging.set(key, cell = { ...empty(), models: new Map() })
            if(!cell.models.has(model)) cell.models.set(model, { ...empty(), values: [] })
            const run = cell.models.get(model)
            const half = this.models.get(model).size / 2
            for(const box of [cell, run])
            {
                box.min.min({ x: world.x - half, y: world.y - half, z: world.z - half })
                box.max.max({ x: world.x + half, y: world.y + half, z: world.z + half })
            }
            for(let k = 0; k < 16; k++) run.values.push(list[i + 4 + k])
        }
        for(const [key, cell] of staging)
            this.cells.set(key, { center: cell.min.clone().add(cell.max).multiplyScalar(0.5), radius: cell.min.distanceTo(cell.max) / 2,
                models: [...cell.models].map(([model, run]) => ({ model, size: this.models.get(model).size,
                    center: run.min.clone().add(run.max).multiplyScalar(0.5), radius: run.min.distanceTo(run.max) / 2,
                    matrices: new Float32Array(run.values) })) })
        this.placements = list.length / stride
    }

    // Megacity becomes solid and the flight envelope widens to what this tier draws.
    setupCollision(manifest, heights)
    {
        this.collision = new MegacityCollision(manifest.collision, heights)
        this.collisionBody = this.collision.createBody()
        this.world.physics.world.addBody(this.collisionBody)
        const car = {}, walker = {}
        this.world.physics.world.addEventListener('postStep', () =>
        {
            if(!this.container.visible) return
            this.collision.guard(this.world.physics.car.chassis.body, car)
            const explorer = this.world.explorer
            if(explorer?.active) this.collision.guard(explorer.body, walker)
            else walker.x = undefined
        })
        const c = manifest.frame.clearing, reach = this.profile.explore || 0
        this.flightBounds = { min: [c.x0 - reach, c.y0 - reach], max: [c.x1 + reach, c.y1 + reach], ceiling: MEGACITY_CEILING }
    }

    setupProxies(models, counts)
    {
        const byName = new Map([...models].map(([id, model]) => [model.name, id]))
        const shared = new Map()
        for(const [id] of this.models)
        {
            const name = models.get(id).name
            const rule = TILE_PROXIES.find(r => r.family.test(name))
            if(!rule || !byName.has(rule.proxy)) continue
            const key = rule.proxy + (rule.crop || '')
            if(!shared.has(key))
            {
                const source = models.get(byName.get(rule.proxy)).lods.distant
                if(!source) continue
                shared.set(key, { rule, members: [],
                    parts: source.map(part => ({ geometry: rule.crop ? cropProxy(part.geometry, rule.crop) : part.geometry, material: part.material })) })
            }
            shared.get(key).members.push(id)
        }
        for(const group of shared.values())
        {
            const capacity = group.members.reduce((sum, id) => sum + (counts.get(id) || 0), 0)
            const attribute = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 16), 16)
            attribute.setUsage(THREE.DynamicDrawUsage)
            const meshes = group.parts.map(part =>
            {
                const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity)
                mesh.instanceMatrix = attribute
                mesh.count = 0
                mesh.frustumCulled = false
                mesh.matrixAutoUpdate = false
                mesh.castShadow = mesh.receiveShadow = !!this.profile.shadow
                mesh.userData.model = `proxy:${group.rule.proxy}${group.rule.crop ? '/2' : ''}`
                this.container.add(mesh)
                this.meshes.push(mesh)
                return mesh
            })
            const level = { attribute, meshes, count: 0 }
            for(const id of group.members)
            {
                const entry = this.models.get(id)
                entry.levels[2] = level
                const far = entry.levels[1].meshes.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count, 0)
                if(far > (this.profile.proxyFar ?? PROXY_FAR_VERTICES)) entry.levels[1] = level
            }
        }
        this.proxyGroups = shared.size
    }

    // The quality governor stepped down (or back up): each tier below the one the
    // ring was loaded for pulls the draw distances in by 30%; Low hides it.
    setQuality(tier)
    {
        const order = ['low', 'medium', 'high', 'ultra']
        const drop = order.indexOf(this.profileTier) - order.indexOf(tier)
        this.reach = drop > 0 ? 0.7 ** drop : 1
        this.container.visible = tier !== 'low'
        // A hidden ring must not leave invisible towers behind.
        const physics = this.world.physics?.world
        if(this.collisionBody && physics)
        {
            const added = physics.bodies.includes(this.collisionBody)
            if(this.container.visible && !added) physics.addBody(this.collisionBody)
            if(!this.container.visible && added) physics.removeBody(this.collisionBody)
        }
        this.lastPack = -Infinity
    }

    // Copy the visible cells into the instanced meshes. Cheap enough to run a
    // few times a second; skipped while the camera holds still.
    update()
    {
        if(!this.ready || !this.container.visible) return
        if(this.shadowPending)
        {
            this.shadowPending = false
            this.packForShadow()
            this.lastPack = -Infinity
            return
        }
        const camera = this.world.camera.instance
        const now = this.world.time.elapsed
        camera.getWorldDirection(this.forward)
        const moved = camera.position.distanceToSquared(this.lastCamera) > 9 || this.forward.dot(this.lastForward) < 0.985
        // Repack only when the view changed (static meshes need no refresh).
        if(this.lastPack !== -Infinity && (!moved || now - this.lastPack < 120)) return
        this.lastPack = now
        this.lastCamera.copy(camera.position)
        this.lastForward.copy(this.forward)
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        this.frustum.setFromProjectionMatrix(this.projection)
        for(const entry of this.models.values()) for(const level of entry.levels) level.count = 0
        const { near } = this.profile
        const far = this.profile.far * this.reach, max = this.profile.max * this.reach, small = this.profile.small * this.reach
        for(const cell of this.cells.values())
        {
            this.sphere.center.copy(cell.center)
            this.sphere.radius = cell.radius
            if(Math.max(0, camera.position.distanceTo(cell.center) - cell.radius) > max || !this.frustum.intersectsSphere(this.sphere)) continue
            for(const run of cell.models)
            {
                const distance = Math.max(0, camera.position.distanceTo(run.center) - run.radius)
                if(distance > max) continue
                if(run.size < 3 && distance > small) continue
                if(run.size < 12 && distance > far * 1.6) continue
                const level = this.models.get(run.model).levels[pickLod(distance, run.size, near, far)]
                level.attribute.array.set(run.matrices, level.count * 16)
                level.count += run.matrices.length / 16
            }
        }
        this.commit()
    }

    commit()
    {
        for(const entry of this.models.values())
            for(const level of entry.levels)
            {
                for(const mesh of level.meshes) mesh.count = level.count
                if(level.count)
                {
                    level.attribute.clearUpdateRanges?.()
                    level.attribute.addUpdateRange?.(0, level.count * 16)
                    level.attribute.needsUpdate = true
                }
            }
    }

    // The ring and the sun direction never move, so the shadow map is rendered
    // once: pack every cell around the district (far LOD), render, then go back
    // to packing for the camera.
    setupShadow()
    {
        const renderer = this.world.renderer
        const sun = this.world.megacityAtmosphere?.sun
        if(!sun) return
        renderer.shadowMap.enabled = true
        renderer.shadowMap.type = THREE.PCFShadowMap
        renderer.shadowMap.autoUpdate = false
        sun.castShadow = true
        sun.shadow.mapSize.set(this.profile.shadow, this.profile.shadow)
        const extent = this.profile.shadow >= 4096 ? 900 : 650
        Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 10, far: 3600 })
        sun.shadow.camera.updateProjectionMatrix()
        sun.shadow.bias = -0.0006
        sun.shadow.normalBias = 0.8
        this.shadowExtent = extent
        this.uniforms.uRingCanyon.value = 0.35
        this.shadowPending = true
    }

    packForShadow()
    {
        for(const entry of this.models.values()) for(const level of entry.levels) level.count = 0
        const center = this.world.megacityAtmosphere.sun.target.position
        for(const cell of this.cells.values())
        {
            if(Math.abs(cell.center.x - center.x) > this.shadowExtent + cell.radius || Math.abs(cell.center.y - center.y) > this.shadowExtent + cell.radius) continue
            for(const run of cell.models)
            {
                if(run.size < 3) continue
                const level = this.models.get(run.model).levels[1]
                level.attribute.array.set(run.matrices, level.count * 16)
                level.count += run.matrices.length / 16
            }
        }
        this.commit()
        this.world.renderer.shadowMap.needsUpdate = true
    }
}
