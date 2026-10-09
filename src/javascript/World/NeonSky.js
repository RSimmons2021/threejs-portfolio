import * as THREE from 'three'

// Sky dome that follows the camera.
// Day: blue sky with sunlit cumulus (lit tops, grey-blue bellies, silver linings) and a sun glow.
// Dusk: warm horizon band. Night: dark sky, clouds lit from below by the city glow.
// Below the horizon it fades into the fog colour so the skyline dissolves into haze.
export default class NeonSky
{
    constructor(world)
    {
        this.world = world
        const shared = world.materials.cyber.shared
        this.material = new THREE.ShaderMaterial({
            depthWrite: false, depthTest: true, depthFunc: THREE.LessEqualDepth, side: THREE.BackSide,
            uniforms: { uZenith: shared.uZenith, uHorizon: shared.uHorizon, uGlow: shared.uGlow, uFogHigh: shared.uFogHighColor,
                uDaylight: shared.uDaylight, uDusk: shared.uDusk, uSunDir: shared.uSunDir, uSunColor: shared.uSunColor, uTime: { value: 0 } },
            vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
            fragmentShader: `uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGlow; uniform vec3 uFogHigh; uniform float uDaylight; uniform float uDusk;
                uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uTime;
                varying vec3 vDir;
                float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                    return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
                float fbm(vec2 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 5; i++){ v += a * n(p); p = p * 2.02 + vec2(11.7, 3.1); a *= 0.5; } return v; }
                float clouds(vec2 p, float coverage){
                    float base = fbm(p * 0.55);
                    float detail = n(p * 2.1 + 7.0) * 0.6 + n(p * 4.3 + 3.0) * 0.4;
                    return smoothstep(1.0 - coverage, 1.0 - coverage + 0.32, base * 0.75 + detail * 0.35);
                }
                void main(){
                    vec3 d = normalize(vDir);
                    float up = d.z;
                    float sunAmount = max(dot(d, uSunDir), 0.0);
                    vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.85, max(up, 0.0)), 0.7));
                    // Warm band at dawn/dusk, city glow at night.
                    col += vec3(1.0, 0.45, 0.2) * uDusk * 0.55 * exp(-max(up, 0.0) * 5.0) * (0.4 + 0.6 * sunAmount);
                    col += uGlow * (1.0 - uDaylight) * exp(-max(up, 0.0) * 6.0) * 0.9;
                    // Sun glow + disc behind the clouds.
                    vec3 sunTint = uSunColor / max(max(uSunColor.r, uSunColor.g), 0.001);
                    col += sunTint * (pow(sunAmount, 6.0) * 0.18 + pow(sunAmount, 64.0) * 0.6) * uDaylight;
                    if(up > 0.0)
                    {
                        vec2 p = d.xy / (up + 0.12) * 2.2 + vec2(uTime * 0.012, uTime * 0.004);
                        float coverage = mix(0.42, 0.55, uDaylight);
                        float c = clouds(p, coverage);
                        // Self-shadowing: density a little toward the sun darkens the belly.
                        float toward = clouds(p + uSunDir.xy * 0.18, coverage);
                        float lightAmt = clamp(1.0 - (toward - c) * 1.6 - toward * 0.35, 0.0, 1.0);
                        vec3 lit = vec3(1.0, 0.98, 0.95) * (0.85 + 0.35 * sunTint.r) ;
                        vec3 shade = mix(vec3(0.5, 0.55, 0.63), uHorizon * 0.9, 0.4);
                        vec3 cloudDay = mix(shade, lit, lightAmt);
                        cloudDay += sunTint * pow(sunAmount, 10.0) * (1.0 - c) * 0.8;           // silver lining
                        cloudDay = mix(cloudDay, cloudDay * vec3(1.05, 0.7, 0.5), uDusk * 0.6);
                        vec3 cloudNight = mix(uZenith * 2.0, uGlow * 0.8, smoothstep(0.5, 0.0, up)) * (0.6 + 0.4 * lightAmt);
                        vec3 cloud = mix(cloudNight, cloudDay, uDaylight);
                        float fade = smoothstep(0.0, 0.18, up);
                        col = mix(col, cloud, c * fade * 0.95);
                    }
                    // Haze toward and below the horizon matches the fog, so the skyline dissolves.
                    col = mix(col, uFogHigh, smoothstep(0.16, -0.04, up) * mix(0.85, 0.7, uDaylight));
                    gl_FragColor = vec4(col, 1.0);
                }`
        })
        this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), this.material)
        this.mesh.frustumCulled = false
        // Drawn after the opaque city with a far-plane depth test, so only
        // pixels that actually show sky pay for the cloud noise.
        this.mesh.renderOrder = 1
        world.container.add(this.mesh)
        world.time.on('tick', () =>
        {
            const camera = world.camera.instance
            this.mesh.position.copy(camera.position)
            this.mesh.scale.setScalar(camera.far * 0.9)
            this.mesh.updateMatrixWorld()
            this.material.uniforms.uTime.value = world.time.elapsed * 0.001
        })
    }
}
