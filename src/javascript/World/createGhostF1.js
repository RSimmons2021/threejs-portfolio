import * as THREE from 'three'

// Both the guide and visit replay share the real Blender car's proportions.
export default function createGhostF1(resources, material)
{
    const group = new THREE.Group()
    group.name = 'Ghost F1 / Blender chassis and open wheels'
    const chassis = resources.items.carDefaultChassis || resources.items.carCyberTruckChassis
    const wheel = resources.items.carDefaultWheel || resources.items.carCyberTruckWheel
    group.add(chassis.scene.clone(true))
    const wheels = []
    for(const x of [0.98, -0.92]) for(const y of [-0.83, 0.83])
    {
        const mesh = wheel.scene.clone(true)
        mesh.position.set(x, y, 0.26)
        wheels.push(mesh)
        group.add(mesh)
    }
    group.traverse((mesh) => { if(mesh.isMesh) mesh.material = material })
    group.userData.wheels = wheels
    return group
}
