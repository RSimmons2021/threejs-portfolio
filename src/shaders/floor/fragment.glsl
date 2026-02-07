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
    float puddleNoiseC = sin((vUv.x * 1.3 - vUv.y * 0.7 + uTime * 0.008) * 14.0);
    float puddle = smoothstep(0.3, 0.85, puddleNoiseA * 0.5 + puddleNoiseB * 0.3 + puddleNoiseC * 0.2);

    vec3 darkened = mix(backgroundColor.rgb, backgroundColor.rgb * 0.55, uWetness * 0.7);

    // Fake reflection: sample with flipped/offset UV to simulate blurry mirror
    float ripple = sin(vUv.x * 40.0 + uTime * 0.12) * sin(vUv.y * 35.0 - uTime * 0.1) * 0.003;
    vec2 reflectUv = vec2(vUv.x + ripple, 1.0 - vUv.y + ripple * 1.5);
    vec3 reflectColor = texture(tBackground, reflectUv).rgb;
    // Blend reflection into puddle areas
    vec3 wetColor = mix(darkened, reflectColor * 0.4 + darkened * 0.6, puddle * uWetness * 0.45);

    // Shimmer highlights on top
    float shimmer = (0.35 + 0.65 * sin((vUv.x - vUv.y) * 38.0 + uTime * 0.08)) * puddle * uWetness * 0.18;
    // Specular-like highlight at glancing angles
    float specular = pow(max(0.0, sin(vUv.x * 60.0 + uTime * 0.15) * sin(vUv.y * 55.0 - uTime * 0.12)), 8.0) * puddle * uWetness * 0.12;
    vec3 finalColor = wetColor + vec3(shimmer + specular);

    gl_FragColor = vec4(finalColor, backgroundColor.a);
}
