// Combined glow + vignette pass (one fullscreen read/write instead of two)
uniform sampler2D tDiffuse;

uniform vec2 uGlowPosition;
uniform float uGlowRadius;
uniform vec3 uGlowColor;
uniform float uGlowAlpha;

uniform float uVignetteIntensity;
uniform float uVignetteSmoothness;

uniform vec3 uFogColor;
uniform float uFogIntensity;
uniform float uTime;
uniform vec3 uCameraPosition;
uniform mat4 uInverseViewProjection;

varying vec2 vUv;

#include ../partials/cnoise.glsl

void main()
{
    vec4 diffuseColor = texture2D(tDiffuse, vUv);

    // Glow
    float glowStrength = distance(vUv, uGlowPosition) / uGlowRadius;
    glowStrength = 1.0 - glowStrength;
    glowStrength *= uGlowAlpha;
    glowStrength = clamp(glowStrength, 0.0, 1.0);
    vec3 color = mix(diffuseColor.rgb, uGlowColor, glowStrength);

    // Volumetric-style rolling ground mist: reconstruct the world-space ground
    // point for this pixel and sample drifting noise there, so the fog is made
    // of patches anchored to the world instead of a flat screen wash
    if(uFogIntensity > 0.001)
    {
        vec2 ndc = vUv * 2.0 - 1.0;
        vec4 farPoint = uInverseViewProjection * vec4(ndc, 1.0, 1.0);
        vec3 rayDirection = normalize(farPoint.xyz / farPoint.w - uCameraPosition);

        float fogAmount = 0.0;

        if(rayDirection.z < - 0.0001)
        {
            float rayDistance = - uCameraPosition.z / rayDirection.z;
            vec2 groundPoint = uCameraPosition.xy + rayDirection.xy * rayDistance;

            // Two octaves of drifting noise = soft mist banks
            float drift = uTime * 0.00002;
            float noise = cnoise(groundPoint * 0.055 + vec2(drift * 3.0, drift * 2.0)) * 0.65
                        + cnoise(groundPoint * 0.16 - vec2(drift * 5.0, drift * 4.0)) * 0.35;
            noise = noise * 0.5 + 0.5;
            noise = smoothstep(0.18, 0.85, noise);

            // Farther ground reads as denser fog (aerial perspective)
            float distanceFactor = smoothstep(6.0, 42.0, rayDistance);

            fogAmount = uFogIntensity * (noise * 0.75 + 0.25) * (0.35 + distanceFactor * 0.65);
        }
        else
        {
            // Rays that never hit the ground (horizon/sky) get full haze
            fogAmount = uFogIntensity;
        }

        color = mix(color, uFogColor, clamp(fogAmount, 0.0, 0.92));
    }

    // Vignette
    float dist = length(vUv - 0.5);
    float vignette = smoothstep(uVignetteSmoothness, uVignetteSmoothness - 0.35, dist);
    vignette = mix(1.0, vignette, uVignetteIntensity);
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
}
