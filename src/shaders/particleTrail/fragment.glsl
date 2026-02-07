varying float vAlpha;
varying vec3 vColor;

void main()
{
    // Create circular particles
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float strength = 0.05 / distanceToCenter - 0.1;
    strength = clamp(strength, 0.0, 1.0);

    // Apply glow effect
    vec3 finalColor = vColor * strength;
    float finalAlpha = vAlpha * strength;

    gl_FragColor = vec4(finalColor, finalAlpha);
}
