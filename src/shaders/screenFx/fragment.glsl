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

varying vec2 vUv;

void main()
{
    vec4 diffuseColor = texture2D(tDiffuse, vUv);

    // Glow
    float glowStrength = distance(vUv, uGlowPosition) / uGlowRadius;
    glowStrength = 1.0 - glowStrength;
    glowStrength *= uGlowAlpha;
    glowStrength = clamp(glowStrength, 0.0, 1.0);
    vec3 color = mix(diffuseColor.rgb, uGlowColor, glowStrength);

    // Weather fog / mist: stronger toward the top of the screen (the distance)
    if(uFogIntensity > 0.001)
    {
        float fogAmount = uFogIntensity * (0.65 + 0.5 * vUv.y);
        color = mix(color, uFogColor, clamp(fogAmount, 0.0, 0.92));
    }

    // Vignette
    float dist = length(vUv - 0.5);
    float vignette = smoothstep(uVignetteSmoothness, uVignetteSmoothness - 0.35, dist);
    vignette = mix(1.0, vignette, uVignetteIntensity);
    color *= vignette;

    gl_FragColor = vec4(color, 1.0);
}
