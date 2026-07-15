import * as THREE from 'three'

import shaderFragment from '../../shaders/matcap/fragment.glsl'
import shaderVertex from '../../shaders/matcap/vertex.glsl'

export default function()
{
    const uniforms = {
        ...THREE.UniformsLib.common,
        ...THREE.UniformsLib.bumpmap,
        ...THREE.UniformsLib.normalmap,
        ...THREE.UniformsLib.displacementmap,
        ...THREE.UniformsLib.fog,
        matcap: { value: null },
        uRevealProgress: { value: null },
        uIndirectDistanceAmplitude: { value: null },
        uIndirectDistanceStrength: { value: null },
        uIndirectDistancePower: { value: null },
        uIndirectAngleStrength: { value: null },
        uIndirectAngleOffset: { value: null },
        uIndirectAnglePower: { value: null },
        uIndirectColor: { value: null },
        uNightTint: { value: new THREE.Color(1, 1, 1) },
        uSpotPosition: { value: new THREE.Vector3(0, 0, 6) },
        uSpotDirection: { value: new THREE.Vector3(0, 0, - 1) },
        uSpotColor: { value: new THREE.Color(1, 1, 1) },
        uSpotIntensity: { value: 0 },
        uSpotAngleCos: { value: Math.cos(Math.PI * 0.25) },
        uSpotPenumbraCos: { value: Math.cos(Math.PI * 0.18) },
        uSpotDistance: { value: 30 }
    }

    const extensions = {
        derivatives: false,
        fragDepth: false,
        drawBuffers: false,
        shaderTextureLOD: false
    }

    const defines = {
        MATCAP: ''
    }

    const material = new THREE.ShaderMaterial({
        wireframe: false,
        transparent: false,
        uniforms,
        extensions,
        defines,
        lights: false,
        vertexShader: shaderVertex,
        fragmentShader: shaderFragment
    })

    return material
}
