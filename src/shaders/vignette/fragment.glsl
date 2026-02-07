uniform sampler2D tDiffuse;
uniform float uIntensity;
uniform float uSmoothness;

varying vec2 vUv;

void main()
{
    vec4 color = texture2D(tDiffuse, vUv);

    // Distance from center (0 at center, ~0.707 at corners)
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // Smooth vignette falloff
    float vignette = smoothstep(uSmoothness, uSmoothness - 0.35, dist);
    vignette = mix(1.0, vignette, uIntensity);

    color.rgb *= vignette;

    gl_FragColor = color;
}
