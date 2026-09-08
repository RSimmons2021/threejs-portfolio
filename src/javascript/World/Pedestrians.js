import * as THREE from 'three'

// Shared geometry and materials keep the crowd inexpensive. People intentionally
// have no physics bodies: both the driver and walker pass straight through them.
export function createPerson(materials, color = '#ffb627')
{
    const group = new THREE.Group()
    const box = createPerson.box ||= new THREE.BoxGeometry(1, 1, 1)
    const palette = createPerson.palette ||= new Map()
    const material = hex =>
    {
        if(!palette.has(hex)) palette.set(hex, materials.getCelMaterial(new THREE.Color(hex)))
        return palette.get(hex)
    }
    const part = (size, position, hex, parent = group) =>
    {
        const mesh = new THREE.Mesh(box, material(hex))
        mesh.scale.set(...size)
        mesh.position.set(...position)
        parent.add(mesh)
        return mesh
    }
    part([0.48, 0.28, 0.58], [0, 0, 1.04], color)
    part([0.31, 0.3, 0.34], [0, 0, 1.52], '#c99170')
    part([0.34, 0.32, 0.12], [0, -0.025, 1.72], '#172334')
    part([0.34, 0.06, 0.1], [0, 0.16, 1.57], '#86ded7')
    const limbs = []
    for(const side of [-1, 1])
    {
        const leg = new THREE.Group()
        leg.position.set(side * 0.14, 0, 0.78)
        group.add(leg)
        part([0.19, 0.23, 0.6], [0, 0, -0.3], '#243449', leg)
        part([0.21, 0.33, 0.15], [0, 0.035, -0.68], '#eee3cb', leg)
        const arm = new THREE.Group()
        arm.position.set(side * 0.33, 0, 1.25)
        group.add(arm)
        part([0.16, 0.21, 0.53], [0, 0, -0.25], color, arm)
        limbs.push(leg, arm)
    }
    group.userData.animate = (phase, moving) => limbs.forEach((limb, i) =>
    {
        limb.rotation.x = moving ? Math.sin(phase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.5 : 0
    })
    return group
}

export default class Pedestrians
{
    constructor(world)
    {
        this.container = new THREE.Group()
        this.container.name = 'City pedestrians / nonblocking'
        const routes = [[-9, -4, -9, -19], [9, -8, 9, -20], [-12, -26, -48, -26],
            [-48, -52, -28, -52], [12, -38, 28, -38], [34, -38, 46, -38],
            [58, -38, 70, -38], [82, -38, 94, -38], [106, -38, 118, -38],
            [130, -38, 142, -38], [-9, -49, -9, -59], [10, -49, 10, -59]]
        this.people = routes.map((route, i) =>
        {
            const person = createPerson(world.materials, ['#e6a53b', '#619fba', '#bf7197', '#69ada1'][i % 4])
            person.userData.route = route
            return person
        })
        const byMaterial = new Map()
        for(const person of this.people) person.traverse(mesh =>
        {
            if(!mesh.isMesh) return
            if(!byMaterial.has(mesh.material)) byMaterial.set(mesh.material, [])
            byMaterial.get(mesh.material).push(mesh)
        })
        this.batches = [...byMaterial].map(([material, parts]) =>
        {
            const mesh = new THREE.InstancedMesh(createPerson.box, material, parts.length)
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
            mesh.frustumCulled = false
            this.container.add(mesh)
            return { mesh, parts }
        })
        world.time.on('tick', () =>
        {
            const t = world.time.elapsed / 1000
            this.people.forEach((person, i) =>
            {
                const [ax, ay, bx, by] = person.userData.route
                const length = Math.hypot(bx - ax, by - ay)
                const travel = (t * 0.85 / length + i * 0.17) % 2
                const progress = travel <= 1 ? travel : 2 - travel
                person.position.set(ax + (bx - ax) * progress, ay + (by - ay) * progress, 0.09)
                person.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2 + (travel > 1 ? Math.PI : 0)
                person.userData.animate(t * 5 + i, !world.config.reducedMotion)
                person.updateMatrixWorld(true)
            })
            for(const { mesh, parts } of this.batches)
            {
                parts.forEach((part, i) => mesh.setMatrixAt(i, part.matrixWorld))
                mesh.instanceMatrix.needsUpdate = true
            }
        })
    }
}
