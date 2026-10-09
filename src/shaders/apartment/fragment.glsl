uniform sampler2D uAtlas;
uniform sampler2D uMask;
uniform vec3 uRoomOrigin;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vAO;

vec3 lamp(vec3 p, vec3 n, vec3 at, vec3 color, float radius)
{
    vec3 delta = at - p;
    float d = length(delta);
    float fall = max(0.0, 1.0 - d / radius);
    // Three broad diffuse bands: a cel-lit room without real-time shadows.
    float facing = max(dot(n, delta / max(d, 0.01)), 0.0);
    facing = mix(0.18, mix(0.55, 1.0, step(0.65, facing)), step(0.2, facing));
    return color * fall * fall * facing;
}

void main()
{
    vec3 p = vWorld - uRoomOrigin;
    vec3 n = normalize(vNormal);
    vec3 albedo = texture2D(uAtlas, vUv).rgb;
    float emission = texture2D(uMask, vUv).b;
    // Constant interior fill is independent of outdoor sun/fog/volume bounds.
    vec3 light = vec3(0.40, 0.48, 0.57) * (0.8 + 0.2 * max(n.z, 0.0));
    light += lamp(p, n, vec3(0.0, 0.1, 3.15), vec3(2.0, 1.5, 1.02), 9.0);
    light += lamp(p, n, vec3(-2.6, 0.2, 3.1), vec3(0.13, 1.45, 2.0), 7.0);
    light += lamp(p, n, vec3(3.2, 1.0, 2.65), vec3(1.8, 0.12, 0.8), 5.0);
    light += lamp(p, n, vec3(1.5, 3.4, 1.8), vec3(0.12, 0.7, 1.15), 6.0);
    gl_FragColor = vec4(albedo * light * mix(0.3, 1.0, vAO) + albedo * emission * 2.2, 1.0);
}
