import * as THREE from 'three'
import { roundedGuidePath, sampleGuidePath, projectGuidePath, flightGuidePath, guideArrived, smoothGuideRotation } from './cityGuideRules.js'

const CAPACITY = 16
const RIBBON_POINTS = 64
const visibility = `
    float trailFade(float distance) {
        float span = max(.01, uEnd - uProgress);
        return smoothstep(0.0, min(3.0, span * .25), distance - uProgress - 1.0)
            * (1.0 - smoothstep(uEnd - min(7.0, span * .3), uEnd, distance));
    }
`

// Two bounded draw calls: one cached street ribbon and one chevron batch.
// No textures, lights, postprocessing, time-based pulse, or extra animation loop.
export default class GuideTrail
{
    constructor(container)
    {
        this.uniforms = {
            uColor: { value: new THREE.Color('#68e9f5') },
            uProgress: { value: 0 }, uEnd: { value: 0 }
        }
        const options = { uniforms: this.uniforms, side: THREE.DoubleSide, transparent: true, depthWrite: false, toneMapped: false }
        this.markerMaterial = new THREE.ShaderMaterial({
            ...options,
            vertexShader: `
                attribute float guideDistance;
                varying float vDistance;
                void main() {
                    vDistance = guideDistance;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uProgress;
                uniform float uEnd;
                varying float vDistance;
                ${visibility}
                void main() {
                    float alpha = vDistance < 0.0 ? .95 : .7 * trailFade(vDistance);
                    if(alpha < .005) discard;
                    gl_FragColor = vec4(uColor, alpha);
                    #include <colorspace_fragment>
                }
            `
        })
        // Preserve the guide's public color handle for UI/diagnostics.
        this.markerMaterial.color = this.uniforms.uColor.value
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
            -.6,-.48,0, .05,0,0, -.6,.48,0, -.4,.48,0, .28,0,0, -.4,-.48,0
        ], 3))
        geometry.setIndex([0,1,5, 5,1,4, 1,2,3, 1,3,4])
        geometry.setAttribute('guideDistance', new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY), 1).setUsage(THREE.DynamicDrawUsage))
        this.markers = new THREE.InstancedMesh(geometry, this.markerMaterial, CAPACITY)
        this.markers.name = 'Dynamic lead / street-anchored chevrons'
        this.markers.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        this.markers.frustumCulled = false
        this.markers.count = 0
        container.add(this.markers)

        const ribbonGeometry = new THREE.BufferGeometry()
        ribbonGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RIBBON_POINTS * 6), 3).setUsage(THREE.DynamicDrawUsage))
        ribbonGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(RIBBON_POINTS * 4), 2).setUsage(THREE.DynamicDrawUsage))
        const indices = []
        for(let i = 0; i < RIBBON_POINTS - 1; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
        ribbonGeometry.setIndex(indices)
        ribbonGeometry.setDrawRange(0, 0)
        this.ribbonMaterial = new THREE.ShaderMaterial({
            ...options,
            vertexShader: `
                varying vec2 vGuide;
                void main() {
                    vGuide = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uProgress;
                uniform float uEnd;
                varying vec2 vGuide;
                ${visibility}
                void main() {
                    float edge = 1.0 - smoothstep(.1, 1.0, abs(vGuide.y));
                    float core = 1.0 - smoothstep(.05, .35, abs(vGuide.y));
                    float alpha = (.14 * edge + .44 * core) * trailFade(vGuide.x);
                    if(alpha < .005) discard;
                    gl_FragColor = vec4(uColor, alpha);
                    #include <colorspace_fragment>
                }
            `
        })
        this.ribbon = new THREE.Mesh(ribbonGeometry, this.ribbonMaterial)
        this.ribbon.name = 'Soft street route / flight approach ribbon'
        this.ribbon.frustumCulled = false
        this.ribbon.renderOrder = 1
        this.markers.renderOrder = 2
        container.add(this.ribbon)
        this.transform = new THREE.Object3D()
        this.sample = {}
        this.leadTarget = {}
        this.flightPoints = []
        this.leadYaw = null
        this.leadPitch = 0
        this.flying = false
    }

    setGroundPath(path)
    {
        this.groundPath = roundedGuidePath(path)
        if(!this.flying) this.writeRibbon(this.groundPath)
    }

    writeRibbon(path)
    {
        // The authored street graph has at most five junctions; each has eight
        // bounded curve steps. Flight uses eleven points. Reject silent overflow.
        if(path.length > RIBBON_POINTS) throw new Error('Guide ribbon exceeds its fixed geometry budget')
        const geometry = this.ribbon.geometry, positions = geometry.attributes.position, uv = geometry.attributes.uv
        let nx = 0, ny = 1
        for(let i = 0; i < path.length; i++)
        {
            const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)], p = path[i]
            const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
            // Keep the last horizontal normal during vertical descent rather
            // than twisting the landing ribbon at its final segment.
            if(length > .001) { nx = -dy / length; ny = dx / length }
            positions.setXYZ(i * 2, p.x + nx * .28, p.y + ny * .28, p.z)
            positions.setXYZ(i * 2 + 1, p.x - nx * .28, p.y - ny * .28, p.z)
            uv.setXY(i * 2, p.s, -1)
            uv.setXY(i * 2 + 1, p.s, 1)
        }
        positions.needsUpdate = true
        uv.needsUpdate = true
        geometry.setDrawRange(0, Math.max(0, (path.length - 1) * 6))
    }

    setVisible(visible)
    {
        this.markers.visible = visible
        this.ribbon.visible = visible
    }

    update(position, destination, deltaSeconds, reducedMotion)
    {
        if(!this.groundPath) return
        if(guideArrived(position, destination)) { this.setVisible(false); return }
        this.setVisible(true)
        const flying = position.z > 3
        if(!flying && this.flying) this.writeRibbon(this.groundPath)
        this.flying = flying
        const path = flying ? flightGuidePath(position, destination, this.flightPoints) : this.groundPath
        if(flying) this.writeRibbon(path)
        this.progress = flying ? 0 : projectGuidePath(path, position)
        const end = Math.min(path[path.length - 1].s, this.progress + (flying ? 70 : 42))
        this.uniforms.uProgress.value = this.progress
        this.uniforms.uEnd.value = end
        sampleGuidePath(path, this.progress + (flying ? 10 : 7), this.leadTarget)
        const dx = this.leadTarget.x - position.x, dy = this.leadTarget.y - position.y
        const dz = flying ? this.leadTarget.z - (position.z - .75) : 0
        const horizontal = Math.hypot(dx, dy)
        const desired = horizontal > .001 ? Math.atan2(dy, dx) * 180 / Math.PI : (this.leadYaw ?? 0)
        this.leadYaw = smoothGuideRotation(this.leadYaw, desired, deltaSeconds, reducedMotion)
        const pitch = Math.atan2(dz, horizontal)
        this.leadPitch = flying ? this.leadPitch + (pitch - this.leadPitch) * (reducedMotion ? 1 : 1 - Math.exp(-Math.min(deltaSeconds, .1) * 18)) : 0
        const yaw = this.leadYaw * Math.PI / 180
        this.transform.position.set(position.x + 2 * Math.cos(yaw) * Math.cos(this.leadPitch), position.y + 2 * Math.sin(yaw) * Math.cos(this.leadPitch), flying ? position.z - .75 + 2 * Math.sin(this.leadPitch) : .1)
        this.transform.rotation.set(0, -this.leadPitch, yaw, 'ZYX')
        this.transform.scale.setScalar(1)
        this.transform.updateMatrix()
        this.markers.setMatrixAt(0, this.transform.matrix)
        const distances = this.markers.geometry.attributes.guideDistance
        distances.setX(0, -1)
        let count = 1
        // Fixed arc-length marks: moving only reveals/hides them; they do not
        // translate along the road. The lead is the only player-relative arrow.
        for(let s = Math.ceil((this.progress + .5) / 7) * 7; s < end && count < CAPACITY; s += 7)
        {
            sampleGuidePath(path, s, this.sample)
            this.transform.position.set(this.sample.x, this.sample.y, this.sample.z + .025)
            this.transform.rotation.set(0, -this.sample.pitch, this.sample.yaw, 'ZYX')
            this.transform.scale.setScalar(.7)
            this.transform.updateMatrix()
            this.markers.setMatrixAt(count, this.transform.matrix)
            distances.setX(count, s)
            count++
        }
        this.markers.count = count
        this.markers.instanceMatrix.needsUpdate = true
        distances.needsUpdate = true
    }

    clear()
    {
        this.setVisible(false)
        this.markers.count = 0
        this.ribbon.geometry.setDrawRange(0, 0)
        this.groundPath = null
        this.leadYaw = null
        this.leadPitch = 0
        this.flying = false
    }
}
