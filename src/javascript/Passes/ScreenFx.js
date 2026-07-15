import shaderFragment from '../../shaders/screenFx/fragment.glsl'
import shaderVertex from '../../shaders/screenFx/vertex.glsl'

export default {
    uniforms:
    {
        tDiffuse: { type: 't', value: null },
        uGlowPosition: { type: 'v2', value: null },
        uGlowRadius: { type: 'f', value: null },
        uGlowColor: { type: 'v3', value: null },
        uGlowAlpha: { type: 'f', value: null },
        uVignetteIntensity: { type: 'f', value: null },
        uVignetteSmoothness: { type: 'f', value: null },
        uFogColor: { type: 'v3', value: null },
        uFogIntensity: { type: 'f', value: 0 },
        uTime: { type: 'f', value: 0 },
        uCameraPosition: { type: 'v3', value: null },
        uInverseViewProjection: { type: 'm4', value: null }
    },
    vertexShader: shaderVertex,
    fragmentShader: shaderFragment
}
