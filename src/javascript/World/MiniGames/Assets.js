import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// All fixed arena pieces merge by slot; repeated moving pieces are instanced.
// Geometry is shared between runs. Only per-run buffers/materials are disposed.
export default class Assets
{
    constructor(world)
    {
        this.world = world
        this.nodes = new Map()
        const scene = world.resources.items.cyberMiniGames.scene
        scene.updateMatrixWorld(true)
        for(const node of scene.children)
        {
            const parts = []
            node.traverse(mesh =>
            {
                if(mesh.isMesh) parts.push({ geometry: world.neonCity.normalise(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)), slot: mesh.material.name })
            })
            this.nodes.set(node.name, parts)
        }
        this.cards = world.resources.items.cyberMiniGameAtlas.rects
        this.texture = world.resources.items.cyberMiniGameCardsTexture
        this.texture.colorSpace = THREE.SRGBColorSpace
        this.texture.flipY = false
        this.texture.needsUpdate = true
        this.window = world.resources.items.cyberArenaWindowTexture
        this.window.colorSpace = THREE.SRGBColorSpace
        this.window.flipY = false
        this.window.needsUpdate = true
    }

    material(slot, run)
    {
        const c = this.world.materials.cyber
        if(slot === 'nd_card') return run.cardMaterial ||= c.mappedScreen(this.texture)
        if(slot === 'nd_screen') return run.screenMaterial ||= c.mappedScreen(run.screenTexture)
        if(slot === 'nd_window') return run.windowMaterial ||= c.mappedScreen(this.window)
        if(slot === 'nd_belt')
        {
            if(!run.beltMaterial)
            {
                run.beltMaterial = c.create().clone()
                run.beltMaterial.uniforms = { ...c.create().uniforms }
                run.beltMaterial.defines = { CONVEYOR: 1 }
            }
            return run.beltMaterial
        }
        return c.forSlot(slot)
    }

    rect(geometry, id)
    {
        const rect = this.cards.find(card => card.id === id)
        if(!rect) return
        const [u0, v0, u1, v1] = rect.uv
        const uv = geometry.attributes.uv
        // Rect metadata uses bottom-left; kit glTF UVs and unflipped textures are top-left.
        for(let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), 1 - v1 + uv.getY(i) * (v1 - v0))
        uv.needsUpdate = true
    }

    fixed(run, placements)
    {
        const slots = new Map(), transform = new THREE.Object3D()
        for(const { name, p, rot = 0, card } of placements)
        {
            transform.position.set(...p); transform.rotation.set(0, 0, rot); transform.updateMatrix()
            for(const part of this.nodes.get(name) || [])
            {
                const g = part.geometry.clone().applyMatrix4(transform.matrix)
                if(part.slot === 'nd_card' && card) this.rect(g, card)
                if(!slots.has(part.slot)) slots.set(part.slot, [])
                slots.get(part.slot).push(g)
            }
        }
        for(const [slot, geometries] of slots)
        {
            const geometry = mergeGeometries(geometries)
            geometries.forEach(g => g.dispose())
            const mesh = new THREE.Mesh(geometry, this.material(slot, run))
            run.root.add(mesh); run.geometries.push(geometry)
        }
    }

    instances(run, name, count, card, tinted = false)
    {
        const meshes = []
        for(const part of this.nodes.get(name) || [])
        {
            const geometry = part.geometry.clone()
            if(tinted) geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3))
            if(part.slot === 'nd_card' && card) this.rect(geometry, card)
            const material = tinted && part.slot === 'nd_atlas' ? this.world.materials.cyber.create({ atlas: true, ao: true, tinted: true }) : this.material(part.slot, run)
            const mesh = new THREE.InstancedMesh(geometry, material, count)
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
            mesh.frustumCulled = false
            mesh.count = 0
            run.root.add(mesh); run.geometries.push(geometry); meshes.push(mesh)
        }
        const transform = new THREE.Object3D()
        return {
            meshes,
            set(index, p, scale = 1, quaternion = null)
            {
                transform.position.set(...p); transform.scale.setScalar(scale)
                transform.quaternion.identity()
                if(quaternion) transform.quaternion.copy(quaternion)
                transform.updateMatrix()
                meshes.forEach(mesh => mesh.setMatrixAt(index, transform.matrix))
            },
            commit(n) { meshes.forEach(mesh => { mesh.count = n; mesh.instanceMatrix.needsUpdate = true; if(tinted) mesh.geometry.attributes.aTint.needsUpdate = true }) },
            tint(index, color) { const c = new THREE.Color(color); meshes.forEach(mesh => mesh.geometry.attributes.aTint?.setXYZ(index, c.r, c.g, c.b)) },
            card: id => meshes.forEach(mesh =>
            {
                if(mesh.material === run.cardMaterial)
                {
                    const source = this.nodes.get(name).find(part => part.slot === 'nd_card')
                    mesh.geometry.attributes.uv.array.set(source.geometry.attributes.uv.array)
                    this.rect(mesh.geometry, id)
                }
            })
        }
    }

    deliveryMarkers(run, racks)
    {
        // Three portals in a single draw; no lights, shadow maps or collision
        // bodies. Their six-metre aperture matches Packet Run's delivery test.
        const geometry = new THREE.TorusGeometry(6, 0.22, 4, 40)
        geometry.rotateX(Math.PI / 2)
        const material = new THREE.MeshBasicMaterial({ color: '#63ffb0', toneMapped: false })
        const rings = new THREE.InstancedMesh(geometry, material, racks.length)
        rings.userData.deliveryLabels = []
        const transform = new THREE.Object3D()
        racks.forEach((rack, i) =>
        {
            transform.position.set(...rack.intakeRing); transform.updateMatrix()
            rings.setMatrixAt(i, transform.matrix)
            const canvas = document.createElement('canvas')
            canvas.width = 512; canvas.height = 192
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#071e24'; ctx.fillRect(0, 0, 512, 192)
            ctx.strokeStyle = '#63ffb0'; ctx.lineWidth = 12; ctx.strokeRect(6, 6, 500, 180)
            ctx.textAlign = 'center'; ctx.fillStyle = '#eafff3'
            ctx.font = 'bold 60px monospace'; ctx.fillText(`DROP OFF ${rack.id}`, 256, 87)
            ctx.fillStyle = '#63ffb0'; ctx.font = 'bold 30px monospace'; ctx.fillText('FLY THROUGH TO DELIVER', 256, 148)
            const texture = new THREE.CanvasTexture(canvas)
            texture.colorSpace = THREE.SRGBColorSpace
            const labelMaterial = new THREE.SpriteMaterial({ map: texture, toneMapped: false })
            const label = new THREE.Sprite(labelMaterial)
            label.position.set(rack.intakeRing[0], rack.intakeRing[1], rack.intakeRing[2] + 9)
            label.scale.set(8, 3, 1)
            rings.userData.deliveryLabels.push(label)
            run.root.add(label)
            run.disposables.push(texture, labelMaterial)
        })
        run.root.add(rings); run.geometries.push(geometry); run.disposables.push(material)
        return rings
    }

    arena(run, id, filter = () => true)
    {
        const arena = this.world.resources.items.cyberMiniGameSpec.arenas[id]
        run.origin = arena.origin
        run.root.position.set(...arena.origin)
        const placements = [{ name: arena.shell, p: [0, 0, 0] }]
        for(const [name, list] of Object.entries(arena.place))
            if(filter(name)) list.forEach((p, i) => placements.push({ name, p: p.slice(0, 3), rot: p[3],
                card: name === 'mg_app_phone' ? ['app_focusfi', 'app_lucid'][i] : name.startsWith('mg_bin_') ? `bin_${name.slice(7)}` : name === 'mg_station' ? ['plate_code', 'plate_build_ios', 'plate_build_android', 'plate_payments'][i] : undefined }))
        this.fixed(run, placements)
        return arena
    }
}
