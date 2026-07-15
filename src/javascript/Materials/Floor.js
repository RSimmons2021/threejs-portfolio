import * as THREE from 'three'

import shaderFragment from '../../shaders/floor/fragment.glsl'
import shaderVertex from '../../shaders/floor/vertex.glsl'

export default function()
{
    const uniforms = {
        tBackground: { value: null },
        uWetness: { value: 0 },
        uTime: { value: 0 },
        uCameraPosition: { value: new THREE.Vector3() },
        uInverseViewProjection: { value: new THREE.Matrix4() },
        uSpotPosition: { value: new THREE.Vector2() },
        uSpotColor: { value: new THREE.Color(1, 1, 1) },
        uSpotIntensity: { value: 0 },
        uSpotRadius: { value: 8 }
    }

    const material = new THREE.ShaderMaterial({
        wireframe: false,
        transparent: false,
        uniforms,
        vertexShader: shaderVertex,
        fragmentShader: shaderFragment
    })

    return material
}
