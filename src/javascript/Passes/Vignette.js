import shaderFragment from '../../shaders/vignette/fragment.glsl'
import shaderVertex from '../../shaders/vignette/vertex.glsl'

export default {
    uniforms:
    {
        tDiffuse: { type: 't', value: null },
        uIntensity: { type: 'f', value: null },
        uSmoothness: { type: 'f', value: null }
    },
    vertexShader: shaderVertex,
    fragmentShader: shaderFragment
}
