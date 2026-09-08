import * as THREE from 'three'
import { FACING_ANGLE, signBoard } from './createStorefront.js'

/**
 * The apartment you sleep in, modelled in Blender (static/models/nyc/apartment.glb)
 * and exported Z-up like the rest of the city so it drops straight into world space.
 * Materials are re-created here from each mesh's baked colour so the building joins
 * the shared cel-shading pipeline instead of shipping its own lighting.
 */
export default function createApartment({ resources, materials, name, sign, colour, facing, lighting })
{
    const group = new THREE.Group()
    group.rotation.z = FACING_ANGLE[facing] ?? 0

    const lit = []
    let dayMaterial = null
    let nightMaterial = null

    resources.items.apartment.scene.traverse((_source) =>
    {
        if(!_source.isMesh) return
        const mesh = _source.clone()
        // The warm windows, the transom and the stoop lamp glow after dark; the
        // rest of the facade takes the flat cel treatment the city uses.
        const isWarm = _source.name.includes('warm')
        if(isWarm)
        {
            // getCelMaterial caches and shares by colour+emission, so animating a
            // uniform here would light up every mesh in the city using that
            // colour. Two cached variants and a swap keeps the sharing intact.
            dayMaterial ||= materials.getCelMaterial(_source.material.color, 0.2)
            nightMaterial ||= materials.getCelMaterial(_source.material.color, 0.9)
            mesh.material = dayMaterial
            lit.push(mesh)
        }
        else
        {
            mesh.material = materials.getCelMaterial(_source.material.color, 0)
        }
        mesh.matrixAutoUpdate = false
        mesh.updateMatrix()
        group.add(mesh)
    })

    const board = signBoard(name, sign, colour, false, 'home')
    board.position.set(0, 0.22, 3.95)
    board.rotation.set(Math.PI * 0.5, 0, Math.PI, 'ZYX')
    group.add(board)

    const overhead = new THREE.Mesh(board.geometry, board.material.clone())
    overhead.material.depthWrite = false
    overhead.position.set(0, - 0.7, 3.72)
    overhead.rotation.z = - (FACING_ANGLE[facing] ?? 0)
    group.add(overhead)

    board.visible = false
    group.userData.setView = (_firstPerson) =>
    {
        board.visible = _firstPerson
        overhead.visible = !_firstPerson
    }
    // The apartment is never gated, so locking is a no-op that keeps the door
    // interface identical to every storefront.
    group.userData.setLocked = () => {}

    let litAtNight = false
    group.userData.update = () =>
    {
        const night = lighting ? lighting.nightFactor : 0
        const shouldGlow = night > 0.45
        if(shouldGlow === litAtNight) return
        litAtNight = shouldGlow
        const material = shouldGlow ? nightMaterial : dayMaterial
        for(const mesh of lit) mesh.material = material
    }

    return group
}
