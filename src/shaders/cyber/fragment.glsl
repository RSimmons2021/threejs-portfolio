// Neon District surface shader.
// lit = albedo * ao * (sky * skyVisibility * hemisphere + neonBounce) + emissive, then height/distance fog.
// skyVisibility and neonBounce come from the baked light volume (light-volume.json).
uniform sampler2D uAtlas;
#ifdef PROJECT_SCREEN
uniform sampler2D uProjectTexture;
#endif
uniform sampler2D uMask;
#ifdef PLAYER_LIGHT
uniform vec3 uPlayerLight;
#endif
uniform vec2 uAtlasSize;
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
uniform float uDetail;
uniform sampler2D uNoise;
#ifdef WET_GROUND
uniform sampler2D uGroundAO;
uniform vec4 uGroundAOBounds;
#endif
uniform vec3 uSpotPosition;
uniform vec3 uSpotColor;
uniform float uSpotIntensity;
uniform int uSpillCount;
uniform vec4 uSpillPosition[8];
uniform vec4 uSpillColor[8];
uniform vec3 uSpillNormal[8];
uniform vec4 uCarGlow;
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

// Value noise from a 64x64 tiling texture: one bilinear fetch instead of
// four sin() hashes, and its mipmaps keep distant detail from shimmering.
float tnoise(vec2 p) { return texture2D(uNoise, p * 0.015625).r; }

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
    float eye = max(cameraPosition.z, 0.0) / uFogHeight;
    float end = max(vWorld.z, 0.0) / uFogHeight;
    float dz = end - eye;
    // Integrate height haze along the view ray: a roof viewed from a dark
    // street and a street viewed from altitude must not get identical haze.
    float heightK = abs(dz) < 0.01 ? exp(-eye) : (exp(-eye) - exp(-end)) / dz;
    float density = uFogDensity * (0.6 + 1.2 * heightK);
    // Megacity layers local density volumes over a thin global haze. Drifting
    // low-frequency patches stand in for those volumes along the view ray.
    vec2 mid = (vWorld.xy + cameraPosition.xy) * 0.5;
    float patches = tnoise(mid * 0.021 + uTime * vec2(0.006, 0.004)) * 0.65 + tnoise(mid * 0.06 - uTime * 0.01) * 0.35;
    density *= mix(1.0, 0.65 + 0.7 * patches, uDetail);
    // exp2 haze: near detail stays crisp, the far canyon dissolves completely.
    // The linear term is aerial perspective: towers recede even from altitude.
    float fog = 1.0 - exp(-pow(d * density, 2.0) - d * uFogDensity * mix(0.55, 0.25, uDaylight));
    vec3 fogColor = mix(uFogColor, uFogHighColor, smoothstep(2.0, 85.0, (vWorld.z + cameraPosition.z) * 0.5));
    // Teal canyon haze low down (Megacity's maze volumes), neutral above.
    fogColor = mix(fogColor, fogColor * vec3(0.82, 1.08, 1.06), (1.0 - smoothstep(4.0, 30.0, vWorld.z)) * 0.6);
    // Keep coloured scatter local: the far canyon shouldn't become rainbow fog.
    fogColor += bounce * uNeonIntensity * 0.012 * exp(-d * 0.035);
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
        #ifdef PLAYER_LIGHT
            // Player-only accent material; never recolour the shared crowd atlas.
            albedo = mix(albedo, uPlayerLight, mask.b);
        #endif
        glass = mask.r;
        // G stores an ID only where R is glass; the wall stores zero in both.
        // Filtering therefore premultiplies the ID by glass coverage. Recover
        // the original 8-bit ID before the nonlinear room selection, otherwise
        // a dark window can acquire a bright/random border as it gets smaller.
        float id = floor(clamp(mask.g / max(glass, 0.0001), 0.0, 1.0) * 255.0 + 0.5) / 255.0;
        float on = step(fract(vSeed * 17.31 + id * 7.13), uLitFraction);
        // A few windows flicker or are TV-blue; most lit ones are warm or cool white.
        float tint = fract(vSeed * 3.71 + id * 13.7);
        vec3 room = tint < 0.55 ? vec3(1.0, 0.68, 0.38) : (tint < 0.9 ? vec3(0.78, 0.9, 1.0) : vec3(0.45, 0.75, 1.0));
        float level = 0.55 + 0.9 * hash(id * 91.7 + vSeed * 3.3);
        // Once multiple atlas texels fit inside a pixel, a filtered ID can
        // contain several rooms. Fade to their average light energy instead of
        // hashing those interpolated IDs (which produces shimmering confetti).
        vec2 footprint = fwidth(vUv) * uAtlasSize;
        float detail = 1.0 - smoothstep(1.5, 6.0, max(footprint.x, footprint.y));
        // Rooms are not flat panels: ceiling lights fall off toward the sill,
        // some blinds are half drawn, and brightness wanders across a window.
        float storey = fract(vWorld.z / 3.2);
        float blind = step(0.62, hash(id * 53.1 + vSeed * 9.7)) * (1.0 - step(0.45 + 0.4 * hash(id * 7.9 + vSeed), storey));
        level *= mix(1.0, (0.55 + 0.55 * storey) * (1.0 - blind * 0.75) * (0.75 + 0.5 * tnoise(vWorld.xy * 1.3 + vWorld.z * 0.9)), uDetail);
        on = mix(uLitFraction, on, detail);
        room = mix(vec3(0.8685, 0.7675, 0.659), room, detail);
        level = mix(1.0, level, detail);
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
    #ifdef PROJECT_SCREEN
        vec3 artwork = texture2D(uProjectTexture, vUv).rgb;
        float scan = mix(0.97 + 0.03 * sin(vUv.y * 320.0 + uTime * 1.5), 1.0, uReducedMotion);
        albedo = artwork * 0.12;
        emissive = artwork * scan * mix(1.35, 1.0, uDaylight);
    #endif
    #ifdef CONVEYOR
        float belt = step(0.84, fract(vUv.y * 12.0 - uTime * 0.8 * (1.0 - uReducedMotion)));
        albedo = mix(vec3(0.035, 0.05, 0.065), vec3(0.12, 0.17, 0.19), belt);
        emissive = vec3(0.02, 0.11, 0.14) * belt;
    #endif
    #ifdef TINTED
        #ifndef SCREEN
            albedo *= vTint;
            emissive *= vTint;
        #endif
    #endif

    // Weathering. Megacity's facades carry mask and detail maps. Here: rain
    // streaks running down walls, soot near the street, patchy roofs. Faded
    // out with distance before the value noise can alias.
    float near = uDetail * (1.0 - smoothstep(45.0, 110.0, distance(cameraPosition, vWorld)));
    if(near > 0.0)
    {
        vec3 an = abs(n);
        float weathering = 1.0;
        if(an.z < 0.6)
        {
            vec2 wall = vec2(an.x > an.y ? vWorld.y : vWorld.x, vWorld.z);
            float streaks = tnoise(vec2(wall.x * 2.3, wall.y * 0.07 + vSeed * 31.0));
            float blotches = tnoise(wall * vec2(0.4, 0.25) + vSeed * 17.0);
            weathering = mix(0.62, 1.08, streaks * 0.55 + blotches * 0.45);
            weathering *= mix(0.6, 1.0, smoothstep(0.0, 3.5, vWorld.z));
        }
        else if(n.z > 0.0)
        {
            #ifdef WET_GROUND
                // Asphalt: aggregate, darker repair patches, polished wheel tracks.
                float aggregate = tnoise(vWorld.xy * 3.7) * 0.6 + tnoise(vWorld.xy * 13.0) * 0.4;
                float repairs = smoothstep(0.58, 0.66, tnoise(vWorld.xy * vec2(0.09, 0.13) + 7.0));
                weathering = (0.8 + 0.35 * aggregate) * (1.0 - repairs * 0.3);
            #else
                weathering = mix(0.7, 1.05, tnoise(vWorld.xy * 0.45 + vSeed * 5.0) * 0.6 + tnoise(vWorld.xy * 2.1) * 0.4);
            #endif
        }
        albedo *= mix(1.0, weathering, near * (1.0 - glass));
    }
    #ifdef WET_GROUND
        // Asphalt dries to a mid grey in clear daylight; rain keeps it black and wet.
        float dryness = uDaylight * clamp((1.0 - uWetness) / 0.7, 0.0, 1.0);
        albedo *= mix(1.0, 2.1, dryness);
    #endif
    // Sunlit concrete reads sandstone-warm by day (Megacity's palette), not neutral grey.
    albedo *= mix(vec3(1.0), vec3(1.07, 1.0, 0.9), uDaylight * (1.0 - glass));

    // Overcast hemisphere: roofs catch the sky, walls get a soft side light so the masses read.
    float hemi = clamp(n.z * 0.5 + 0.5, 0.0, 1.0);
    float side = 0.86 + 0.14 * dot(n.xy, normalize(vec2(-0.55, -0.83)));
    // By day, shaded canyons are lit mostly by sun bounced off the facades
    // opposite: a warm fill that grows as the sky closes in.
    vec3 ambient = mix(uGroundColor, uSkyColor, hemi) * side * mix(mix(0.055, 0.22, uDaylight), 1.0, sky * sqrt(sky));
    ambient += uSunColor * (1.0 - sky) * 0.045 * (0.6 + 0.4 * (1.0 - hemi));
    // Key sun, masked by the baked sun-shadow volume (soft, canyon-scale shadows).
    float sunVis = 0.0;
    float ndl = max(dot(n, uSunDir), 0.0);
    if(dot(uSunColor, vec3(1.0)) > 0.001) sunVis = sampleSun(vWorld + n * 0.6);
    vec3 direct = uSunColor * ndl * sunVis;
    vec3 lit = albedo * vAO * (ambient + direct + bounce * uNeonIntensity);
    float headlight = pow(max(0.0, 1.0 - distance(vWorld, uSpotPosition) / 16.0), 2.0);
    // Soft spill only. The car has no projected/visible headlight beams.
    lit += albedo * uSpotColor * headlight * uSpotIntensity * 0.08;

    vec3 localSpecular = vec3(0.0);
    for(int i = 0; i < 8; i++)
    {
        if(i >= uSpillCount) break;
        vec3 delta = uSpillPosition[i].xyz - vWorld;
        float radius = uSpillPosition[i].w;
        float d2 = dot(delta, delta);
        if(d2 > radius * radius) continue;
        vec3 l = delta * inversesqrt(max(d2, 0.01));
        float distanceFall = max(0.0, 1.0 - sqrt(d2) / radius);
        float facing = smoothstep(-0.3, 0.4, dot(-delta, uSpillNormal[i]));
        // Zero normal means a double-sided blade or architectural lamp.
        facing = mix(1.0, facing, step(0.5, dot(uSpillNormal[i], uSpillNormal[i])));
        vec3 radiance = uSpillColor[i].rgb * uSpillColor[i].a * uNeonIntensity * distanceFall * distanceFall * facing;
        lit += albedo * radiance * (0.12 + 0.88 * max(dot(n, l), 0.0));
        vec3 halfVector = normalize(l + viewDir);
        localSpecular += radiance * pow(max(dot(n, halfVector), 0.0), 40.0);
    }
    // A compact underbody pool moves with the hero, never a cone or beam.
    vec3 glowDelta = vWorld - uCarGlow.xyz;
    float glow = exp(-dot(glowDelta.xy, glowDelta.xy) * 0.45) * exp(-abs(glowDelta.z) * 1.5) * uCarGlow.w;
    lit += albedo * vec3(0.15, 0.6, 1.0) * glow;

    // Dark window glass reflects the haze; strongest at grazing angles.
    float fresnel = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 3.0);
    vec3 reflectedSky = mix(uGroundColor, uSkyColor * 0.45, smoothstep(-0.1, 0.8, reflect(-viewDir, n).z));
    lit = mix(lit, reflectedSky * mix(0.08, 1.0, sky) + bounce * uNeonIntensity * 0.25, glass * (0.12 + 0.55 * fresnel));
    lit += localSpecular * glass * 0.65;
    // Sun glints on glass.
    float glint = pow(max(dot(reflect(-viewDir, n), uSunDir), 0.0), 80.0) * sunVis;
    lit += uSunColor * glint * glass * 0.6;

    #ifdef WET_GROUND
        float puddle = smoothstep(0.45, 0.75, tnoise(vWorld.xy * 0.18) * 0.7 + tnoise(vWorld.xy * 0.9) * 0.3);
        float wet = clamp(uWetness * 0.75 + 0.25, 0.0, 1.0) * mix(0.35, 1.0, puddle) * (1.0 - 0.6 * dryness);
        float gloss = pow(1.0 - clamp(viewDir.z, 0.0, 1.0), 2.0);
        // Neon pools: the ground mirrors the coloured light around it, stretched by viewing angle.
        vec4 above = sampleVolume(vWorld + vec3(0.0, 0.0, 6.0));
        vec3 mirrored = above.rgb * above.rgb * uBounceScale * uNeonIntensity * 0.7 + uFogHighColor * 0.3 * above.a;
        lit = mix(lit, lit * 0.5 + mirrored * (0.12 + 0.7 * gloss), wet);
        lit += localSpecular * wet * (0.35 + gloss * 1.4);
        // Baked contact occlusion: towers and street props sit in the pavement.
        vec2 aoUv = (vWorld.xy - uGroundAOBounds.xy) / uGroundAOBounds.zw;
        if(all(greaterThan(aoUv, vec2(0.0))) && all(lessThan(aoUv, vec2(1.0))))
            lit *= texture2D(uGroundAO, aoUv).r;
    #endif

    // Emissives themselves follow the clock, not only their bounced light.
    vec3 color = lit + emissive * mix(0.8, 1.35, 1.0 - uDaylight);
    color = applyFog(color, bounce);
    gl_FragColor = vec4(color, uAlpha);
}
