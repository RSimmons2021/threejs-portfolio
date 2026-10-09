// Neon District surface shader.
// lit = albedo * ao * (sky * skyVisibility * hemisphere + neonBounce) + emissive, then height/distance fog.
// skyVisibility and neonBounce come from the baked light volume (light-volume.json).
uniform sampler2D uAtlas;
uniform sampler2D uMask;
uniform sampler2D uLightVolume;
uniform vec3 uVolumeMin;
uniform vec3 uVolumeMax;
uniform vec3 uVolumeCell;
uniform vec3 uVolumeDims;
uniform vec2 uVolumeTiles;
uniform float uVolumeZOffset;
uniform float uBounceScale;
uniform sampler2D uSunVolume;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uCelColor;
uniform float uCelEmission;
uniform float uAlpha;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform vec3 uFogHighColor;
uniform float uFogDensity;
uniform float uFogHeight;
uniform float uNeonIntensity;
uniform float uLitFraction;
uniform float uDaylight;
uniform float uTime;
uniform float uReducedMotion;
uniform float uWetness;
uniform vec3 uSpotPosition;
uniform vec3 uSpotColor;
uniform float uSpotIntensity;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vAO;
varying float vSeed;
#ifdef TINTED
varying vec3 vTint;
#endif

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p)
{
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), f.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), f.x), f.y);
}

vec4 volumeSlice(vec3 grid, float slice)
{
    vec2 tile = vec2(mod(slice, uVolumeTiles.x), floor(slice / uVolumeTiles.x));
    vec2 uv = (tile * uVolumeDims.xy + clamp(grid.xy, vec2(0.0), uVolumeDims.xy - 1.0) + 0.5) / (uVolumeDims.xy * uVolumeTiles);
    return texture2D(uLightVolume, uv);
}

float sampleSun(vec3 p)
{
    if(any(lessThan(p.xy, uVolumeMin.xy)) || any(greaterThan(p.xy, uVolumeMax.xy)) || p.z > uVolumeMax.z) return 1.0;
    vec3 grid = (p - uVolumeMin - vec3(0.0, 0.0, uVolumeZOffset)) / uVolumeCell;
    grid.z = clamp(grid.z, 0.0, uVolumeDims.z - 1.001);
    float s = floor(grid.z);
    vec2 t0 = vec2(mod(s, uVolumeTiles.x), floor(s / uVolumeTiles.x));
    vec2 t1 = vec2(mod(s + 1.0, uVolumeTiles.x), floor((s + 1.0) / uVolumeTiles.x));
    vec2 g = clamp(grid.xy, vec2(0.0), uVolumeDims.xy - 1.0) + 0.5;
    float a = texture2D(uSunVolume, (t0 * uVolumeDims.xy + g) / (uVolumeDims.xy * uVolumeTiles)).r;
    float b = texture2D(uSunVolume, (t1 * uVolumeDims.xy + g) / (uVolumeDims.xy * uVolumeTiles)).r;
    return mix(a, b, fract(grid.z));
}

vec4 sampleVolume(vec3 p)
{
    if(any(lessThan(p.xy, uVolumeMin.xy)) || any(greaterThan(p.xy, uVolumeMax.xy))) return vec4(0.0, 0.0, 0.0, 1.0);
    vec3 grid = (p - uVolumeMin - vec3(0.0, 0.0, uVolumeZOffset)) / uVolumeCell;
    grid.z = clamp(grid.z, 0.0, uVolumeDims.z - 1.001);
    float s = floor(grid.z);
    vec4 v = mix(volumeSlice(grid, s), volumeSlice(grid, s + 1.0), fract(grid.z));
    // Above the baked volume the sky opens up completely.
    v.a = mix(v.a, 1.0, smoothstep(uVolumeMax.z - 20.0, uVolumeMax.z, p.z));
    return v;
}

vec3 applyFog(vec3 color, vec3 bounce)
{
    float d = distance(cameraPosition, vWorld);
    // Haze thickens toward the street (the canyon floor reads darker and denser).
    float heightK = exp(-max(vWorld.z, 0.0) / uFogHeight);
    float density = uFogDensity * (0.6 + 1.2 * heightK);
    // exp2 haze: near detail stays crisp, the far canyon dissolves completely.
    float fog = 1.0 - exp(-pow(d * density, 2.0) - d * density * 0.25);
    vec3 fogColor = mix(uFogColor, uFogHighColor, smoothstep(0.0, 90.0, vWorld.z));
    fogColor += bounce * uNeonIntensity * 0.03;
    return mix(color, fogColor, clamp(fog, 0.0, 0.985));
}

void main()
{
    vec4 light = sampleVolume(vWorld);
    vec3 bounce = light.rgb * light.rgb * uBounceScale;
    float sky = light.a;
    vec3 n = normalize(vNormal);
    if(!gl_FrontFacing) n = -n;
    vec3 viewDir = normalize(cameraPosition - vWorld);

    vec3 albedo = uCelColor;
    vec3 emissive = albedo * uCelEmission;
    float glass = 0.0;
    #ifdef KIT_ATLAS
        albedo *= texture2D(uAtlas, vUv).rgb;
        vec3 mask = texture2D(uMask, vUv).rgb;
        glass = mask.r;
        float id = mask.g;
        float on = step(fract(vSeed * 17.31 + id * 7.13), uLitFraction);
        // A few windows flicker or are TV-blue; most lit ones are warm or cool white.
        float tint = fract(vSeed * 3.71 + id * 13.7);
        vec3 room = tint < 0.55 ? vec3(1.0, 0.68, 0.38) : (tint < 0.9 ? vec3(0.78, 0.9, 1.0) : vec3(0.45, 0.75, 1.0));
        float level = 0.55 + 0.9 * hash(id * 91.7 + vSeed * 3.3);
        emissive = room * glass * on * level * (1.25 - uDaylight * 0.75);
        // Always-on neon / lamps / screens (mask.b) take their atlas colour, boosted into HDR for bloom.
        emissive += albedo * mask.b * 2.4;
    #endif
    #ifdef SIGN_ATLAS
        albedo = texture2D(uAtlas, vUv).rgb;
        float flicker = 0.92 + 0.08 * step(0.08, noise(vec2(vSeed * 9.0, uTime * 4.0)));
        emissive = albedo * 2.6 * mix(flicker, 1.0, uReducedMotion);
        albedo *= 0.2;
    #endif
    #ifdef SCREEN
        // Hero billboards / terminals: slow scan + accent tint per instance.
        vec3 tintColor = vec3(0.13, 0.9, 1.0);
        #ifdef TINTED
            tintColor = vTint;
        #endif
        float scan = 0.75 + 0.25 * sin(vUv.y * 140.0 + uTime * 2.0);
        float bars = step(0.5, noise(vec2(floor(vUv.y * 9.0), floor(uTime * 0.4 + vSeed))));
        emissive = tintColor * (0.45 + 0.9 * bars * smoothstep(0.1, 0.9, vUv.x)) * scan * 1.6;
        albedo = vec3(0.02);
    #endif
    #ifdef TINTED
        #ifndef SCREEN
            albedo *= vTint;
        #endif
    #endif

    // Overcast hemisphere: roofs catch the sky, walls get a soft side light so the masses read.
    float hemi = 0.42 + 0.58 * clamp(n.z * 0.5 + 0.5, 0.0, 1.0);
    float side = 0.86 + 0.14 * dot(n.xy, normalize(vec2(-0.55, -0.83)));
    vec3 ambient = mix(uGroundColor, uSkyColor, hemi) * side * mix(0.07, 1.0, sky * sky);
    // Key sun, masked by the baked sun-shadow volume (soft, canyon-scale shadows).
    float sunVis = 0.0;
    float ndl = max(dot(n, uSunDir), 0.0);
    if(dot(uSunColor, vec3(1.0)) > 0.001) sunVis = sampleSun(vWorld + n * 0.6);
    vec3 direct = uSunColor * ndl * sunVis;
    vec3 lit = albedo * vAO * (ambient + direct + bounce * uNeonIntensity);
    float headlight = pow(max(0.0, 1.0 - distance(vWorld, uSpotPosition) / 16.0), 2.0);
    lit += albedo * uSpotColor * headlight * uSpotIntensity * 0.35;

    // Dark window glass reflects the haze; strongest at grazing angles.
    float fresnel = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);
    lit = mix(lit, uFogHighColor * (0.25 + 0.55 * sky) + bounce * uNeonIntensity * 0.4, glass * (0.25 + 0.6 * fresnel));
    // Sun glints on glass.
    float glint = pow(max(dot(reflect(-viewDir, n), uSunDir), 0.0), 80.0) * sunVis;
    lit += uSunColor * glint * glass * 0.6;

    #ifdef WET_GROUND
        float puddle = smoothstep(0.45, 0.75, noise(vWorld.xy * 0.18) * 0.7 + noise(vWorld.xy * 0.9) * 0.3);
        float wet = clamp(uWetness * 0.75 + 0.25, 0.0, 1.0) * mix(0.35, 1.0, puddle);
        float gloss = pow(1.0 - clamp(viewDir.z, 0.0, 1.0), 2.0);
        // Neon pools: the ground mirrors the coloured light around it, stretched by viewing angle.
        vec4 above = sampleVolume(vWorld + vec3(0.0, 0.0, 6.0));
        vec3 mirrored = above.rgb * above.rgb * uBounceScale * uNeonIntensity * 0.7 + uFogHighColor * 0.3 * above.a;
        lit = mix(lit, lit * 0.5 + mirrored * (0.12 + 0.7 * gloss), wet);
    #endif

    vec3 color = lit + emissive;
    color = applyFog(color, bounce);
    gl_FragColor = vec4(color, uAlpha);
}
