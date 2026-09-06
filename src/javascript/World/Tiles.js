import * as THREE from 'three'

// Painted directions replace the old raised stone path and its colliders.
export default class Tiles
{
    constructor({ objects })
    {
        this.container = new THREE.Group()
        this.container.name = 'Flush route markings'
        objects.container.add(this.container)
        this.geometry = new THREE.PlaneGeometry(0.7, 0.1)
        this.material = new THREE.MeshBasicMaterial({ color: '#79d6dd', transparent: true, opacity: 0.55, depthWrite: false })
        this.items = []
    }

    add({ start, delta })
    {
        const count = Math.max(1, Math.floor(delta.length() / 2))
        const path = new THREE.InstancedMesh(this.geometry, this.material, count)
        const transform = new THREE.Object3D()
        for(let i = 0; i < count; i++)
        {
            const t = (i + 0.5) / count
            transform.position.set(start.x + delta.x * t, start.y + delta.y * t, 0.008)
            transform.rotation.z = delta.angle()
            transform.updateMatrix()
            path.setMatrixAt(i, transform.matrix)
        }
        this.container.add(path)
        this.items.push(path)
    }
}
