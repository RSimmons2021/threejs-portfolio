import * as THREE from 'three'

/**
 * Materials for interiors.
 *
 * The city's cel material cannot be used indoors. It is built for the street:
 * it discards every fragment whose world z is below zero, and it takes its
 * light from the sun direction and matcap rig, so a room rendered with it comes
 * out as nothing at all. That was the bug behind the invisible apartment — not
 * the GLTF, which was fine the whole time.
 *
 * Interiors get their own even light instead, which is also how a room should
 * read: no sun angle, no ground plane, just flat colour with lit surfaces
 * lifted towards white.
 */
const cache = new Map()

export default function createInteriorMaterial(_colour, _emission = 0)
{
    const base = _colour.isColor ? _colour : new THREE.Color(_colour)
    const key = `${base.getHexString()}|${_emission}`
    if(cache.has(key)) return cache.get(key)

    const colour = base.clone()
    if(_emission > 0) colour.lerp(new THREE.Color('#ffffff'), _emission)

    const material = new THREE.MeshBasicMaterial({ color: colour })
    cache.set(key, material)
    return material
}
