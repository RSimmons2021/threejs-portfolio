varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vAO;
varying float vSeed;
uniform float uRevealProgress;
#ifdef HAS_AO
attribute vec4 color;
#endif
#ifdef HAS_SEED
attribute float aSeed;
#endif
#ifdef SIGN_ATLAS
attribute vec4 aRect;
#endif
#ifdef TINTED
attribute vec3 aTint;
varying vec3 vTint;
#endif

void main()
{
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
        local = instanceMatrix * local;
        n = mat3(instanceMatrix) * n;
    #endif
    vec4 world = modelMatrix * local;
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * n);
    vAO = 1.0;
    #ifdef HAS_AO
        vAO = color.r;
    #endif
    vSeed = 0.0;
    #ifdef HAS_SEED
        vSeed = aSeed;
    #endif
    vUv = uv;
    #ifdef SIGN_ATLAS
        vUv = mix(aRect.xy, aRect.zw, uv);
    #endif
    #ifdef TINTED
        vTint = aTint;
    #endif
    gl_Position = projectionMatrix * viewMatrix * world;
}
