import * as THREE from 'three'
import fragmentShader from '../../shaders/cyber/fragment.glsl'

// Flying traffic on the closed lanes of district-layout.json. Every vehicle is
// placed on the GPU (no per-frame CPU work): lane, phase, speed, side offset
// and altitude are per-instance attributes; lanes are uniform arrays.
const MAX_POINTS = 64
const MAX_LANES = 8
const MIX = { traffic_cab: 0.42, traffic_pod: 0.2, traffic_van: 0.15, traffic_bus: 0.1, traffic_police: 0.06, traffic_hauler: 0.07 }

const vertexShader = `
uniform vec3 uLanePts[${MAX_POINTS}];
uniform float uLaneStart[${MAX_LANES}];
uniform float uLaneCount[${MAX_LANES}];
uniform float uLaneLen[${MAX_LANES}];
uniform float uLaneZ[${MAX_LANES}];
uniform float uClock;
attribute vec4 color;
attribute float aLane;
attribute float aOffset;
attribute float aSpeed;
attribute float aSide;
attribute float aAlt;
attribute float aDir;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vAO;
varying float vSeed;

void main()
{
    int lane = int(aLane + 0.5);
    float start = 0.0, count = 0.0, len = 1.0, z = 0.0;
    for(int i = 0; i < ${MAX_LANES}; i++) { if(i == lane) { start = uLaneStart[i]; count = uLaneCount[i]; len = uLaneLen[i]; z = uLaneZ[i]; } }
    float s = mod(aOffset * len + aDir * uClock * aSpeed, len);
    vec3 a = vec3(0.0), b = vec3(1.0, 0.0, 0.0), c = vec3(2.0, 0.0, 0.0);
    for(int i = 0; i < ${MAX_POINTS - 2}; i++)
    {
        if(float(i) >= count - 1.0) break;
        vec3 p0 = uLanePts[int(start) + i];
        vec3 p1 = uLanePts[int(start) + i + 1];
        if(s >= p0.z && s < p1.z)
        {
            a = p0; b = p1;
            c = (float(i) + 2.0 < count) ? uLanePts[int(start) + i + 2] : uLanePts[int(start) + 1];
        }
    }
    float t = (s - a.z) / max(b.z - a.z, 0.001);
    vec2 pos = mix(a.xy, b.xy, t);
    vec2 d0 = normalize(b.xy - a.xy);
    vec2 d1 = normalize(c.xy - b.xy);
    // Ease the heading round corners over the last 6 m of a segment.
    float corner = smoothstep(max(b.z - a.z - 6.0, 0.0), b.z - a.z, s - a.z);
    vec2 dir = normalize(mix(d0, d1, corner * 0.5)) * aDir;
    vec2 left = vec2(-dir.y, dir.x);
    pos += left * aSide;
    float bob = sin(uClock * 0.9 + aOffset * 40.0) * 0.25;
    vec3 origin = vec3(pos, z + aAlt + bob);
    vec3 fwd = vec3(dir, 0.0);
    vec3 side = vec3(left, 0.0);
    vec3 up = vec3(0.0, 0.0, 1.0);
    vec3 world = origin + fwd * position.x + side * position.y + up * position.z;
    vWorld = world;
    vNormal = normalize(fwd * normal.x + side * normal.y + up * normal.z);
    vUv = uv;
    vAO = color.r;
    vSeed = aOffset;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`

export default class NeonTraffic
{
    constructor(world)
    {
        this.world = world
        this.container = new THREE.Group()
        this.container.name = 'Neon District / flying traffic'
        const lanes = world.resources.items.cyberLayout.lanes.slice(0, MAX_LANES)
        const pts = [], start = [], count = [], len = [], z = []
        for(const lane of lanes)
        {
            const ring = [...lane.points, lane.points[0]]
            start.push(pts.length)
            let acc = 0
            ring.forEach((p, i) =>
            {
                if(i) acc += Math.hypot(p[0] - ring[i - 1][0], p[1] - ring[i - 1][1])
                pts.push(new THREE.Vector3(p[0], p[1], acc))
            })
            count.push(ring.length); len.push(acc); z.push(lane.z)
        }
        while(pts.length < MAX_POINTS) pts.push(new THREE.Vector3())
        const pad = (a) => { while(a.length < MAX_LANES) a.push(0); return a }
        const shared = world.materials.cyber.shared
        const atlas = world.materials.cyber
        this.uniforms = {
            ...world.materials.shades.lightUniforms, ...shared,
            uAtlas: { value: atlas.atlas }, uMask: { value: atlas.mask },
            uCelColor: { value: new THREE.Color('#ffffff') }, uCelEmission: { value: 0 }, uAlpha: { value: 1 },
            uLanePts: { value: pts }, uLaneStart: { value: pad(start) }, uLaneCount: { value: pad(count) },
            uLaneLen: { value: pad(len) }, uLaneZ: { value: pad(z) }, uClock: { value: 0 }
        }
        this.material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms: this.uniforms,
            defines: { KIT_ATLAS: 1, HAS_AO: 1 }, side: THREE.DoubleSide })
        this.lanes = lanes
        this.meshes = []
        const scene = world.resources.items.cyberTraffic.scene
        scene.updateMatrixWorld(true)
        const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647 })()
        const total = 400
        for(const [name, share] of Object.entries(MIX))
        {
            const node = scene.getObjectByName(name)
            if(!node) continue
            let source
            node.traverse(m => { if(m.isMesh && !source) source = m })
            if(!source) continue
            const geometry = world.neonCity.normalise(source.geometry.clone().applyMatrix4(source.matrixWorld))
            const n = Math.round(total * share)
            const attr = { aLane: [], aOffset: [], aSpeed: [], aSide: [], aAlt: [], aDir: [] }
            for(let i = 0; i < n; i++)
            {
                const lane = Math.floor(rng() * lanes.length)
                attr.aLane.push(lane)
                attr.aOffset.push(rng())
                const heavy = name === 'traffic_bus' || name === 'traffic_hauler'
                attr.aSpeed.push(lanes[lane].speed * (heavy ? 0.7 : 0.85 + rng() * 0.4))
                attr.aDir.push(rng() < 0.5 ? 1 : -1)
                attr.aSide.push((rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 2.4) * (heavy ? 1.5 : 1))
                attr.aAlt.push((rng() - 0.5) * 7 + (heavy ? -4 : 0))
            }
            const instanced = new THREE.InstancedBufferGeometry()
            instanced.index = geometry.index
            for(const key of Object.keys(geometry.attributes)) instanced.setAttribute(key, geometry.attributes[key])
            for(const [key, values] of Object.entries(attr)) instanced.setAttribute(key, new THREE.InstancedBufferAttribute(new Float32Array(values), 1))
            instanced.instanceCount = n
            instanced.userData.full = n
            const mesh = new THREE.Mesh(instanced, this.material)
            mesh.frustumCulled = false
            mesh.name = name
            this.container.add(mesh)
            this.meshes.push(mesh)
        }
        this.setQuality(world.quality.settings)
        world.time.on('tick', () => { this.uniforms.uClock.value = world.time.elapsed * 0.001 })
    }

    setQuality(settings)
    {
        const share = Math.min(1, (settings.traffic || 140) / 400)
        for(const mesh of this.meshes) mesh.geometry.instanceCount = Math.max(1, Math.round(mesh.geometry.userData.full * share))
    }
}
