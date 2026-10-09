import * as THREE from 'three'

export default class NeonCrowd
{
    constructor(world)
    {
        this.world = world
        this.container = world.pedestrians.container
        this.ready = false
        world.resources.loadCharacters().then(() => this.build()).catch(error =>
        {
            console.warn('Crowd could not load; portfolio navigation remains available.', error)
        })
    }

    build()
    {
        const w = this.world, spec = w.resources.items.cyberVat
        const source = w.resources.items.cyberNpc.scene.getObjectByName('npc_body')
        const geometry = source.geometry.clone()
        const max = 72 + 6
        geometry.setAttribute('aClip', new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4))
        const texture = w.resources.items.cyberNpcVatTexture
        texture.colorSpace = THREE.NoColorSpace
        texture.magFilter = texture.minFilter = THREE.NearestFilter
        texture.generateMipmaps = false
        texture.flipY = true
        texture.needsUpdate = true
        const base = w.materials.cyber.create({ atlas: true, ao: true })
        const material = base.clone()
        material.uniforms = { ...base.uniforms, uVat: { value: texture },
            uVatMin: { value: new THREE.Vector3(...spec.boundsMin) },
            uVatSize: { value: new THREE.Vector3(...spec.boundsMax).sub(new THREE.Vector3(...spec.boundsMin)) } }
        material.vertexShader = `attribute vec2 uv1;
attribute vec4 aClip;
uniform sampler2D uVat;
uniform vec3 uVatMin;
uniform vec3 uVatSize;
uniform float uTime;
uniform float uReducedMotion;
` + base.vertexShader.replace('vec4 local = vec4(position, 1.0);', `
    float frame = mod(uTime * 30.0 + aClip.z, aClip.y) * (1.0 - uReducedMotion);
    float row = floor(frame);
    vec3 a = texture2D(uVat, vec2(uv1.x, (aClip.x + row + 0.5) / 144.0)).rgb;
    vec3 b = texture2D(uVat, vec2(uv1.x, (aClip.x + mod(row + 1.0, aClip.y) + 0.5) / 144.0)).rgb;
    vec4 local = vec4(uVatMin + mix(a, b, fract(frame)) * uVatSize, 1.0);
`).replace('vUv = uv;', `vUv = uv;
    if(uv.x < 0.0625 && uv.y >= 0.5 && uv.y <= 0.75) vUv.x += aClip.w * 0.0625;`)
        material.fragmentShader = base.fragmentShader.replace('vec3 n = normalize(vNormal);', 'vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));')
        this.mesh = new THREE.InstancedMesh(geometry, material, max)
        this.mesh.name = 'Neon crowd / VAT / noncolliding'
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        this.mesh.frustumCulled = false
        this.container.add(this.mesh)
        this.transform = new THREE.Object3D()
        this.parentInverse = new THREE.Matrix4()
        this.namedMatrix = new THREE.Matrix4()
        this.people = Array.from({ length: 72 }, (_, i) =>
        {
            const route = w.pedestrians.routes[i % 12]
            const person = new THREE.Object3D()
            person.userData.route = route
            return person
        })
        w.pedestrians.people = this.people
        w.careerRPG.applyCosmetics()
        w.explorer.useCyberBoard()
        for(const p of w.careerRPG.npcs.people)
        {
            p.body.visible = false
            const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.61, 24), w.materials.getCelMaterial(new THREE.Color('#22e5ff'), 0.5))
            ring.position.z = 0.02
            p.group.add(ring)
        }
        this.ready = true
        w.time.on('tick.neonCrowd', () => this.update())
        this.update()
    }

    update()
    {
        const w = this.world, t = w.time.elapsed / 1000
        const count = Math.max(12, Math.min(72, Math.floor(w.quality.settings.crowd)))
        this.container.visible = !w.miniGames?.active || w.miniGames.ownsCar
        const attr = this.mesh.geometry.attributes.aClip
        for(let i = 0; i < count; i++)
        {
            const person = this.people[i], [ax, ay, bx, by] = person.userData.route
            const paired = i >= 12 && i % 7 === 0
            const travel = (t * 0.85 / Math.hypot(bx - ax, by - ay) + i * 0.173) % 2
            const progress = paired ? 0.42 : travel <= 1 ? travel : 2 - travel
            person.position.set(ax + (bx - ax) * progress, ay + (by - ay) * progress + (i >= 12 ? (i % 3 - 1) * 0.7 : 0), 0.09)
            person.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2 + (travel > 1 ? Math.PI : 0)
            person.updateMatrix()
            this.mesh.setMatrixAt(i, person.matrix)
            attr.setXYZW(i, paired ? 84 : 60, paired ? 60 : 24, i * 13, i % 6)
        }
        this.parentInverse.copy(this.container.matrixWorld).invert()
        w.careerRPG.npcs.people.forEach((p, i) =>
        {
            p.group.updateMatrixWorld(true)
            this.mesh.setMatrixAt(count + i, this.namedMatrix.copy(p.group.matrixWorld).premultiply(this.parentInverse))
            attr.setXYZW(count + i, w.careerRPG.$dialog.open && w.careerRPG.state.npcs.includes(p.npc.id) ? 84 : 0, 60, i * 11, i)
        })
        this.mesh.count = count + 6
        this.mesh.instanceMatrix.needsUpdate = true
        attr.needsUpdate = true
        this.count = count
    }
}
