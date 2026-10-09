import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Eighteen source SVGs, one bounded texture and two instanced screen draws.
// The facade uses the same artwork as the kiosks and project cinematic.
export default class NeonProjects
{
    constructor(world)
    {
        this.container = new THREE.Group()
        this.container.name = 'Neon Row / project holo gallery'
        this.panels = []
        const kit = world.neonCity.kit, cyber = world.materials.cyber
        const canvas = document.createElement('canvas')
        const width = 768, height = 448, cols = 3
        canvas.width = width * cols; canvas.height = height * 6
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#08131c'; ctx.fillRect(0, 0, canvas.width, canvas.height)
        this.texture = new THREE.CanvasTexture(canvas)
        this.texture.colorSpace = THREE.SRGBColorSpace
        this.texture.flipY = false
        this.texture.anisotropy = 2
        const screen = cyber.mappedScreen(this.texture)
        screen.defines.RECT_ATLAS = 1
        const frames = [], kiosks = [], heroes = []
        const transform = new THREE.Object3D()
        world.sections.projects.items.forEach((project, index) =>
        {
            const hero = world.neonCity.layout.heroBillboards.find(h => h.project === index)
            project.floor.area.container.visible = false
            project.imageSources.forEach((src, slide) =>
            {
                const image = new Image()
                const rect = [(slide * width + 2) / canvas.width, (index * height + 2) / canvas.height,
                    ((slide + 1) * width - 2) / canvas.width, ((index + 1) * height - 2) / canvas.height]
                image.onload = () => { ctx.drawImage(image, slide * width, index * height, width, height); this.texture.needsUpdate = true }
                image.onerror = () => { ctx.fillStyle = '#e9faff'; ctx.font = 'bold 34px monospace'; ctx.fillText(project.name, slide * width + 24, index * height + 90); this.texture.needsUpdate = true }
                image.src = src
                const panel = new THREE.Object3D()
                panel.name = `${project.name} / holo ${slide + 1}`
                panel.position.set(project.x - 5 + slide * 5, project.y + 5, 0)
                panel.updateMatrix()
                kiosks.push({ matrix: panel.matrix.clone(), rect })
                for(const part of kit.get('kit_holo_panel_lod0') || [])
                    if(part.slot !== 'nd_screen') frames.push(part.geometry.clone().applyMatrix4(panel.matrix))
                this.panels.push(panel)
                project.boards.items.push({ planeMesh: panel, texture: this.texture })
                if(slide === 0 && hero)
                {
                    transform.position.set(...hero.p); transform.rotation.set(0, 0, hero.rotZ || 0); transform.updateMatrix()
                    heroes.push({ matrix: transform.matrix.clone(), rect })
                }
            })
            const label = document.createElement('canvas')
            label.width = 1024; label.height = 128
            const c = label.getContext('2d')
            c.fillStyle = '#08131c'; c.fillRect(0, 0, 1024, 128)
            c.fillStyle = project.theme.accent; c.fillRect(0, 0, 8, 128)
            c.font = 'bold 36px monospace'; c.fillText(`${String(index + 1).padStart(2, '0')}  ${project.name.toUpperCase()}`, 28, 54)
            c.fillStyle = '#edfaff'; c.font = '24px monospace'; c.fillText('ENTER / TAP TO EXPLORE   →', 28, 100)
            const map = new THREE.CanvasTexture(label)
            map.colorSpace = THREE.SRGBColorSpace
            const marker = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.8), new THREE.MeshBasicMaterial({ map }))
            marker.position.set(project.floor.area.position.x, project.floor.area.position.y, 0.035)
            this.container.add(marker)
        })
        const frameGeometry = mergeGeometries(frames)
        frames.forEach(g => g.dispose())
        this.container.add(new THREE.Mesh(frameGeometry, cyber.create({ atlas: true, ao: true })))
        for(const [module, placements] of [['holo_panel', kiosks], ['billboard_wall', heroes]])
        {
            const source = kit.get(`kit_${module}_lod0`).find(part => part.slot === 'nd_screen')
            const geometry = source.geometry.clone()
            geometry.setAttribute('aRect', new THREE.InstancedBufferAttribute(new Float32Array(placements.flatMap(p => p.rect)), 4))
            const mesh = new THREE.InstancedMesh(geometry, screen, placements.length)
            mesh.name = `Project artwork / ${module}`
            placements.forEach((p, i) => mesh.setMatrixAt(i, p.matrix))
            mesh.computeBoundingSphere()
            this.container.add(mesh)
        }
    }
}
