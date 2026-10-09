import { DoubleSide } from 'three'

// The closed exported shell faces outward. Render its interior without changing
// shared city paint, glazing, geometry, draw count, or the camera pose.
export function showCabinInterior(root, shellMaterial)
{
    const interior = shellMaterial.clone()
    // ShaderMaterial.clone deep-copies uniforms; lighting/clock/spill must still
    // use the world's live shared uniform objects, not a frozen initial frame.
    if(shellMaterial.isShaderMaterial) interior.uniforms = { ...shellMaterial.uniforms }
    interior.name = 'Cyber cockpit shell'
    interior.side = DoubleSide
    root.traverse(mesh =>
    {
        if(mesh.isMesh && mesh.material === shellMaterial) mesh.material = interior
    })
    return interior
}
