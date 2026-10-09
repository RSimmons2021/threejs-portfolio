import * as THREE from 'three'
import vertexShader from '../../shaders/entry/vertex.glsl'
import fragmentShader from '../../shaders/entry/fragment.glsl'

// One draw for square light shafts, one for their ground apertures. No lights,
// shadow maps, physics bodies, or per-column animation/render passes.
export default class EntryBeacons
{
    constructor(world)
    {
        this.world = world
        this.container = new THREE.Group()
        this.container.name = 'Sky-access entry columns'
        this.capacity = 64
        const positions = [], uvs = []
        const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]
        for(let side = 0; side < 4; side++)
        {
            const a = corners[side], b = corners[(side + 1) % 4]
            for(const [x, y, z, u, v] of [[...a, 0, 0, 0], [...b, 0, 1, 0], [...b, 1, 1, 1],
                [...a, 0, 0, 0], [...b, 1, 1, 1], [...a, 1, 0, 1]])
            {
                positions.push(x, y, z); uvs.push(u, v)
            }
        }
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
        this.uniforms = { uTime: { value: 0 }, uDaylight: world.materials.cyber.shared.uDaylight,
            uReducedMotion: world.materials.cyber.shared.uReducedMotion }
        this.meshes = [geometry, new THREE.PlaneGeometry(1, 1)].map((g, i) =>
        {
            g.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity * 3), 3).setUsage(THREE.DynamicDrawUsage))
            g.setAttribute('aActive', new THREE.InstancedBufferAttribute(new Float32Array(this.capacity), 1).setUsage(THREE.DynamicDrawUsage))
            const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: this.uniforms,
                defines: i ? { FLOOR_MARKER: 1 } : {}, side: THREE.DoubleSide,
                transparent: true, depthWrite: false })
            const mesh = new THREE.InstancedMesh(g, material, this.capacity)
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
            mesh.count = 0; mesh.frustumCulled = false
            mesh.renderOrder = 3
            this.container.add(mesh)
            return mesh
        })
        this.transform = new THREE.Object3D()
        this.color = new THREE.Color()
        this.frustum = new THREE.Frustum(); this.projection = new THREE.Matrix4(); this.sphere = new THREE.Sphere()
        this.$prompt = document.createElement('button')
        this.$prompt.type = 'button'; this.$prompt.className = 'sky-entry'; this.$prompt.hidden = true
        this.$prompt.setAttribute('aria-label', 'Enter this light column')
        document.body.appendChild(this.$prompt)
        this.$prompt.onclick = () =>
        {
            if(this.nearest?.active && this.nearest.contains(world.explorer.position, true)) this.nearest.interact(false)
        }
        world.time.on('tick.entryBeacons', () => this.update())
    }

    update()
    {
        const w = this.world, e = w.explorer, camera = w.camera.instance
        this.uniforms.uTime.value = w.time.elapsed / 1000
        const sky = !e.active && w.hoverFlight.airborne
        const blocked = w.experienceDirector.locks.size > 0 || w.arcade.state !== 'idle' || w.interiors.active
        this.nearest = sky && !blocked ? w.areas.items.find(a => a.active && a.skyAccess && a.contains(e.position, true)) : null
        this.$prompt.hidden = !this.nearest
        if(this.nearest && this.lastLabel !== this.nearest.entryLabel)
        {
            this.lastLabel = this.nearest.entryLabel
            this.$prompt.replaceChildren(document.createTextNode(`Enter ${this.lastLabel} `))
            const hint = document.createElement('kbd'); hint.textContent = 'Enter'
            this.$prompt.appendChild(hint)
        }
        this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
        this.frustum.setFromProjectionMatrix(this.projection)
        let count = 0
        for(const area of w.areas.items)
        {
            if(!area.skyAccess) continue
            if(area.key)
            {
                area.key.container.visible = area.active && area.isIn && !w.config.touch
                // Float the Enter label next to the pilot instead of 40 m below.
                if(sky && area.contains(e.position, true)) area.key.container.position.z = Math.min(area.entryHeight - 1, e.position.z + 1.4)
            }
            if(!area.active || count >= this.capacity) continue
            const x = area.position.x, y = area.position.y, height = area.entryHeight
            if(Math.hypot(x - camera.position.x, y - camera.position.y) > 110) continue
            this.sphere.center.set(x, y, area.floorZ + height / 2)
            this.sphere.radius = height / 2 + Math.max(area.halfExtents.x, area.halfExtents.y)
            if(!this.frustum.intersectsSphere(this.sphere)) continue
            const selected = area.isIn || area === this.nearest || area === w.visitorGuide?.destination?.area
            this.color.set(area.entryColor)
            for(let i = 0; i < this.meshes.length; i++)
            {
                const mesh = this.meshes[i]
                this.transform.position.set(x, y, area.floorZ + 0.045)
                this.transform.scale.set(area.halfExtents.x * 2, area.halfExtents.y * 2, i ? 1 : height)
                this.transform.updateMatrix()
                mesh.setMatrixAt(count, this.transform.matrix)
                mesh.geometry.attributes.aColor.setXYZ(count, this.color.r, this.color.g, this.color.b)
                mesh.geometry.attributes.aActive.setX(count, selected ? 1 : 0.38)
            }
            count++
        }
        for(const mesh of this.meshes)
        {
            mesh.count = count; mesh.instanceMatrix.needsUpdate = true
            mesh.geometry.attributes.aColor.needsUpdate = true; mesh.geometry.attributes.aActive.needsUpdate = true
        }
    }
}
