import * as THREE from 'three'

// A storefront is built facing +y and rotated into place, so every door in
// careerData.js only has to name a wall ("east", "south") rather than an angle.
export const FACING_ANGLE = {
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

// Icons say what a door *is* before you can read the name: a locked door and an
// open one should never look alike from across the street.
const KIND_GLYPH = {
    job: '▶',
    trainer: '▲',
    shop: '◆',
    home: '●',
    arcade: '✦',
    project: '❖'
}

const signTexture = (_name, _sign, _colour, _locked, _kind) =>
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

    // Kind badge on the left so the sign carries meaning at a glance.
    ctx.fillStyle = _locked ? '#1b1f27' : '#16130e'
    ctx.fillRect(10, 10, 150, 236)
    ctx.fillStyle = _locked ? '#8d94a3' : _colour
    ctx.textAlign = 'center'
    ctx.font = 'bold 96px Arial, sans-serif'
    ctx.fillText(_locked ? '✖' : (KIND_GLYPH[_kind] || '●'), 85, 158)

    ctx.fillStyle = _locked ? '#8d94a3' : '#16130e'
    ctx.font = 'bold 78px Arial, sans-serif'
    ctx.fillText(_name, 592, 116)
    ctx.font = 'bold 32px monospace'
    ctx.fillText(_locked ? 'LOCKED' : _sign, 592, 182)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
}

// Shared by createApartment so every enterable building signs itself the same way.
export const signBoard = (_name, _sign, _colour, _locked, _kind) => new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 0.85),
    new THREE.MeshBasicMaterial({ map: signTexture(_name, _sign, _colour, _locked, _kind), transparent: true })
)

// Doorways are cosmetic: the building behind them already owns a collision box,
// and the walker only needs to stand in the Area on the sidewalk to interact.
export default function createStorefront({ materials, name, sign, colour, facing, kind, locked = false })
{
    const group = new THREE.Group()
    group.rotation.z = FACING_ANGLE[facing] ?? 0

    const box = createStorefront.box ||= new THREE.BoxGeometry(1, 1, 1)
    const palette = createStorefront.palette ||= new Map()
    const cel = (hex, emission = 0) =>
    {
        const key = `${hex}|${emission}`
        if(!palette.has(key)) palette.set(key, materials.getCelMaterial(new THREE.Color(hex), emission))
        return palette.get(key)
    }
    const part = (size, position, hex, emission = 0) =>
    {
        const mesh = new THREE.Mesh(box, cel(hex, emission))
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

    // Open doors spill light onto the pavement and carry two lamps; locked ones
    // stay dark. This is the cue you read from a distance, before any text.
    const glow = []
    if(!locked)
    {
        glow.push(part([1.75, 0.06, 2.15], [0, 0.02, 1.12], colour, 0.85))
        glow.push(part([0.2, 0.2, 0.2], [- 1.13, - 0.06, 2.32], '#ffe7b0', 0.9))
        glow.push(part([0.2, 0.2, 0.2], [1.13, - 0.06, 2.32], '#ffe7b0', 0.9))
    }

    // A lit floor decal in the doorway: the strongest "you can go in here" signal
    // from the overhead camera, where the doorway itself is nearly edge-on.
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(locked ? '#39404d' : colour), transparent: true, opacity: locked ? 0.25 : 0.6, depthWrite: false })
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.9), mat)
    decal.position.set(0, - 1.05, 0.03)
    group.add(decal)

    const board = signBoard(name, sign, colour, locked, kind)
    board.position.set(0, 0.42, 3.5)
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
    const overhead = new THREE.Mesh(board.geometry, new THREE.MeshBasicMaterial({
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

    // A slow pulse on the doorway decal reads as "live" without being a beacon.
    group.userData.update = (_elapsed) =>
    {
        if(locked) return
        mat.opacity = 0.45 + Math.sin(_elapsed * 1.6) * 0.14
    }

    group.userData.setLocked = (_next) =>
    {
        if(_next === locked) return
        locked = _next
        const texture = signTexture(name, sign, colour, locked, kind)
        board.material.map = texture
        overhead.material.map = texture
        board.material.needsUpdate = true
        overhead.material.needsUpdate = true
        mat.color.set(locked ? '#39404d' : colour)
        mat.opacity = locked ? 0.25 : 0.6
        for(const mesh of glow) mesh.visible = !locked
    }

    return group
}
