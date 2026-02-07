uniform sampler2D tBackground;
uniform float uWetness;
uniform float uTime;

varying vec2 vUv;

void main()
{
    vec4 backgroundColor = texture(tBackground, vUv);

    // Procedural puddle mask for wet weather.
    float puddleNoiseA = sin((vUv.x + uTime * 0.015) * 28.0) * sin((vUv.y - uTime * 0.012) * 22.0);
    float puddleNoiseB = sin((vUv.x + vUv.y + uTime * 0.01) * 18.0);
    float puddle = smoothstep(0.35, 0.85, puddleNoiseA * 0.6 + puddleNoiseB * 0.4);

    vec3 darkened = mix(backgroundColor.rgb, backgroundColor.rgb * 0.55, uWetness * 0.7);
    float shimmer = (0.35 + 0.65 * sin((vUv.x - vUv.y) * 38.0 + uTime * 0.08)) * puddle * uWetness * 0.18;
    vec3 finalColor = darkened + vec3(shimmer);

    gl_FragColor = vec4(finalColor, backgroundColor.a);
}
