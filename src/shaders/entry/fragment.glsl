uniform float uTime;
uniform float uDaylight;
uniform float uReducedMotion;
varying vec2 vUv;
varying vec3 vColor;
varying float vActive;
void main()
{
    float alpha;
    #ifdef FLOOR_MARKER
        float edge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float rim = 1.0 - smoothstep(0.012, 0.027, edge);
        float corners = (1.0 - step(0.16, min(vUv.x, 1.0 - vUv.x)))
            * (1.0 - step(0.16, min(vUv.y, 1.0 - vUv.y)));
        alpha = rim * (0.48 + 0.3 * vActive) + corners * 0.15 + 0.012;
    #else
        float edge = min(vUv.x, 1.0 - vUv.x);
        float core = 1.0 - smoothstep(0.002, 0.008, edge);
        float glow = exp(-edge * 48.0);
        float heightFade = mix(0.55, 0.12, smoothstep(0.02, 1.0, vUv.y));
        float pulse = mix(0.93 + 0.07 * sin(uTime * 1.4), 1.0, uReducedMotion);
        alpha = (core * 0.38 + glow * 0.08 + 0.007) * heightFade * (0.5 + vActive) * pulse;
    #endif
    gl_FragColor = vec4(vColor * mix(2.2, 1.55, uDaylight), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
