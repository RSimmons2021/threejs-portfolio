uniform vec3 uColor;
uniform float uTime;

varying vec2 vUv;

void main()
{
    vec2 center = vec2(0.5);
    float dist = distance(vUv, center);

    // Pulsing glow
    float pulse = sin(uTime * 2.0) * 0.5 + 0.5;
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    glow = pow(glow, 3.0) * (0.3 + pulse * 0.2);

    vec3 color = uColor * glow;
    float alpha = glow;

    gl_FragColor = vec4(color, alpha);
}
