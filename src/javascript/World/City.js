import * as THREE from 'three'
import CANNON from 'cannon'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export default class City
{
    constructor({ resources, materials, physics, time, lighting })
    {
        this.container = new THREE.Group()
        this.container.name = 'Manhattan circuit / Blender assets'
        this.signPosts = []
        const blocks = new Map()
        resources.items.manhattan.scene.traverse((source) =>
        {
            if(!source.isMesh) return
            const mesh = source.clone()
            const isWindow = source.name.includes('_block') && /^cel_(gold|glass)_/.test(source.name)
            mesh.material = materials.getCelMaterial(source.material.color, isWindow ? 0.65 : 0)
            if(source.name.startsWith('cel_road_'))
            {
                // Keep all existing floor prompts, contact shadows and project
                // panels above the asphalt, including their interaction zones.
                mesh.position.z -= 0.06
                mesh.material.uniforms.uAllowBelowGround.value = 1
            }
            mesh.matrixAutoUpdate = false
            mesh.updateMatrix()
            this.container.add(mesh)
            const block = source.name.match(/block_?(\d+)/)
            if(block)
            {
                if(!blocks.has(block[1])) blocks.set(block[1], new THREE.Box3())
                blocks.get(block[1]).expandByObject(mesh)
            }
        })

        // One simple body per building. Windows and rooftop details never enter physics.
        const shadowGeometries = []
        for(const bounds of blocks.values())
        {
            const center = bounds.getCenter(new THREE.Vector3())
            const size = bounds.getSize(new THREE.Vector3())
            const body = new CANNON.Body({ mass: 0 })
            body.addShape(new CANNON.Box(new CANNON.Vec3(size.x * 0.5, size.y * 0.5, size.z * 0.5)))
            body.position.set(center.x, center.y, center.z)
            physics.world.addBody(body)
            const dx = size.z * 0.6
            const dy = size.z * 0.4
            const shape = new THREE.Shape()
            shape.moveTo(bounds.min.x, bounds.min.y)
            shape.lineTo(bounds.max.x, bounds.min.y)
            shape.lineTo(bounds.max.x + dx, bounds.min.y + dy)
            shape.lineTo(bounds.max.x + dx, bounds.max.y + dy)
            shape.lineTo(bounds.min.x + dx, bounds.max.y + dy)
            shape.lineTo(bounds.min.x, bounds.max.y)
            shape.closePath()
            shadowGeometries.push(new THREE.ShapeGeometry(shape))
        }
        if(shadowGeometries.length)
        {
            const shadows = new THREE.Mesh(mergeGeometries(shadowGeometries), new THREE.MeshBasicMaterial({
                color: '#182b45', transparent: true, opacity: 0.18, depthWrite: false
            }))
            shadows.position.z = 0.052
            this.container.add(shadows)
            shadowGeometries.forEach((geometry) => geometry.dispose())
        }

        this.addSign('MANHATTAN', 'RICHARD SIMMONS / CITY CIRCUIT', 0, 7, 4.2, '#f9cf68')
        for(let i = 0; i < 6; i++)
        {
            this.addSign(`0${i + 1} / PROJECT AVE`, 'PULL IN. TAKE A LOOK.', 30 + i * 24, -23, 4.5, '#97e1dc')
        }
        this.addSign('projects →', '', 7, -23, 3.6, '#ffffff')
        this.addSign('← playground', '', -7, -23, 3.6, '#ffffff')
        this.addSign('information ↓', '', 6, -40, 3.6, '#ffffff')
        const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.1, 1), materials.getCelMaterial(new THREE.Color('#172334')), this.signPosts.length)
        const transform = new THREE.Object3D()
        this.signPosts.forEach(({ x, y, z }, index) =>
        {
            transform.position.set(x, y, z / 2)
            transform.scale.set(1, 1, z)
            transform.updateMatrix()
            posts.setMatrixAt(index, transform.matrix)
        })
        this.container.add(posts)

        // Analytical light reflection: a single transparent ground quad follows
        // the car. No ray tracing, cubemap updates, bloom or extra render passes.
        const material = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: { uIntensity: { value: 0.12 }, uColor: lighting.materials.shades.lightUniforms.uSpotColor },
            vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
            fragmentShader: `varying vec2 vUv; uniform float uIntensity; uniform vec3 uColor;
                void main(){ vec2 p=(vUv-0.5)*2.0; float pool=pow(max(0.0,1.0-dot(p,p)),3.0);
                float streak=0.7+0.3*cos(vUv.y*90.0); gl_FragColor=vec4(uColor,pool*streak*uIntensity); }`
        })
        const reflection = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), material)
        reflection.position.z = 0.06
        this.container.add(reflection)
        time.on('tick', () =>
        {
            const body = physics.car.chassis.body
            reflection.position.x = body.position.x + lighting.forwardVector.x * 2
            reflection.position.y = body.position.y + lighting.forwardVector.y * 2
            reflection.rotation.z = physics.car.angle
            material.uniforms.uIntensity.value = 0.08 + lighting.nightFactor * 0.24
        })
    }

    addSign(title, subtitle, x, y, z, color)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 768
        canvas.height = 192
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#006747'
        ctx.fillRect(0, 0, 768, 192)
        ctx.strokeStyle = '#f6faf0'
        ctx.lineWidth = 5
        ctx.strokeRect(8, 8, 752, 176)
        ctx.fillStyle = '#f6faf0'
        ctx.textAlign = 'center'
        ctx.font = 'bold 54px Arial, sans-serif'
        ctx.fillText(title, 384, subtitle ? 88 : 116)
        ctx.font = 'bold 22px sans-serif'
        ctx.fillText(subtitle, 384, 143)
        for(const x of [24, 744]) for(const y of [24, 168])
        {
            ctx.beginPath()
            ctx.arc(x, y, 3.5, 0, Math.PI * 2)
            ctx.fill()
        }
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: texture }))
        sign.rotation.x = Math.PI / 2
        sign.position.set(x, y, z)
        this.container.add(sign)
        this.signPosts.push({ x: x - 2.65, y: y + 0.06, z }, { x: x + 2.65, y: y + 0.06, z })
    }
}
