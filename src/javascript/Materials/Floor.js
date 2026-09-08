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
        uSpotRadius: { value: 8 },
        // Sky. This quad is NDC-sized and its shader paints every ray that
        // points above the horizon, so the "sky" of this world lives here.
        uSkyHorizon: { value: new THREE.Color('#cfe9f7') },
        uSkyMid: { value: new THREE.Color('#7cc0e8') },
        uSkyZenith: { value: new THREE.Color('#2f7bc4') },
        uSunDirection: { value: new THREE.Vector3(0, 0, 1) },
        uSunColor: { value: new THREE.Color('#ffd9a8') },
        uSunStrength: { value: 1 }
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
