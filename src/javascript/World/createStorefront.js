import * as THREE from 'three'

// A storefront is built facing +y and rotated into place, so every door in
// careerData.js only has to name a wall ("east", "south") rather than an angle.
const FACING_ANGLE = {
    north: 0,
    south: Math.PI,
    east: - Math.PI * 0.5,
    west: Math.PI * 0.5
}

export const facingNormal = (_facing) =>
{
    const angle = FACING_ANGLE[_facing] ?? 0
    return { x: - Math.sin(angle), y: Math.cos(angle) }
}

const signTexture = (_name, _sign, _colour, _locked) =>
{
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = _locked ? '#2b2f38' : _colour
    ctx.fillRect(0, 0, 1024, 256)
    ctx.strokeStyle = '#16130e'
    ctx.lineWidth = 10
    ctx.strokeRect(10, 10, 1004, 236)
    ctx.fillStyle = _locked ? '#8d94a3' : '#16130e'
    ctx.textAlign = 'center'
    ctx.font = 'bold 84px Arial, sans-serif'
    ctx.fillText(_name, 512, 118)
    ctx.font = 'bold 34px monospace'
    ctx.fillText(_locked ? 'LOCKED' : _sign, 512, 186)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

// Doorways are cosmetic: the building behind them already owns a collision box,
// and the walker only needs to stand in the Area on the sidewalk to interact.
export default function createStorefront({ materials, name, sign, colour, facing, locked = false })
{
    const group = new THREE.Group()
    group.rotation.z = FACING_ANGLE[facing] ?? 0

    const box = createStorefront.box ||= new THREE.BoxGeometry(1, 1, 1)
    const palette = createStorefront.palette ||= new Map()
    const cel = (hex) =>
    {
        if(!palette.has(hex)) palette.set(hex, materials.getCelMaterial(new THREE.Color(hex)))
        return palette.get(hex)
    }
    const part = (size, position, hex) =>
    {
        const mesh = new THREE.Mesh(box, cel(hex))
        mesh.scale.set(...size)
        mesh.position.set(...position)
        mesh.matrixAutoUpdate = false
        mesh.updateMatrix()
        group.add(mesh)
        return mesh
    }

    const trim = locked ? '#39404d' : '#16130e'
    // Recessed doorway at walking scale: the opening is 2.3 units tall against a
    // 1.87 eye height, so it reads as a door rather than a loading bay.
    part([2.6, 0.36, 0.3], [0, 0.16, 2.5], trim)
    part([0.35, 0.36, 2.35], [- 1.13, 0.16, 1.175], trim)
    part([0.35, 0.36, 2.35], [1.13, 0.16, 1.175], trim)
    part([1.9, 0.18, 2.3], [0, 0.1, 1.15], locked ? '#1b1f27' : '#0d1420')
    part([2.9, 0.6, 0.16], [0, 0.2, 0.08], trim)

    // Canopy over the door, tinted by the building's own colour.
    part([3.1, 1, 0.22], [0, 0.55, 2.78], locked ? '#39404d' : colour)

    // Hanging sign, readable from the sidewalk in both camera modes.
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.8), new THREE.MeshBasicMaterial({
        map: signTexture(name, sign, colour, locked),
        transparent: true
    }))
    board.position.set(0, 0.42, 3.45)
    // Stand the plane up, then spin it about the vertical axis so it faces the
    // +y front the storefront is authored towards. The "ZYX" order matters: the
    // default "XYZ" applies Z first, which spins the board about its own normal
    // and leaves it facing the back wall.
    board.rotation.set(Math.PI * 0.5, 0, Math.PI, 'ZYX')
    board.matrixAutoUpdate = false
    board.updateMatrix()
    group.add(board)

    // A second copy laid flat above the canopy so the sign is legible from the
    // default overhead camera, where the vertical board is edge-on.
    const overhead = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.8), new THREE.MeshBasicMaterial({
        map: board.material.map,
        transparent: true,
        depthWrite: false
    }))
    overhead.position.set(0, 0.95, 2.95)
    // Counter-rotate so the flat copy stays world-aligned: the overhead camera
    // reads every sign the same way round whatever wall the door is on.
    overhead.rotation.z = - (FACING_ANGLE[facing] ?? 0)
    overhead.matrixAutoUpdate = false
    overhead.updateMatrix()
    group.add(overhead)

    // Only one copy is ever on screen: the standing board at street level, the
    // flat one for the overhead camera. Showing both doubles the label from
    // above and leaves an edge-on sliver across the doorway in first person.
    board.visible = false
    group.userData.setView = (_firstPerson) =>
    {
        board.visible = _firstPerson
        overhead.visible = !_firstPerson
    }

    group.userData.setLocked = (_next) =>
    {
        if(_next === locked) return
        locked = _next
        const texture = signTexture(name, sign, colour, locked)
        board.material.map = texture
        overhead.material.map = texture
        board.material.needsUpdate = true
        overhead.material.needsUpdate = true
    }

    return group
}
