import * as THREE from 'three'
import CANNON from 'cannon'

export default class InformationSection
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.resources = _options.resources
        this.objects = _options.objects
        this.areas = _options.areas
        this.tiles = _options.tiles
        this.debug = _options.debug
        this.x = _options.x
        this.y = _options.y

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        this.setLinks()
        this.setTiles()
    }



    setLinks()
    {
        // Set up
        this.links = {}
        this.links.x = 6.8
        this.links.y = - 1.5
        this.links.halfExtents = {}
        this.links.halfExtents.x = 1
        this.links.halfExtents.y = 1
        this.links.distanceBetween = 4
        this.links.labelWidth = this.links.halfExtents.x * 2 + 1
        this.links.labelGeometry = new THREE.PlaneGeometry(this.links.labelWidth, this.links.labelWidth * 0.25, 1, 1)
        this.links.labelOffset = - 1.6
        this.links.items = []

        this.links.container = new THREE.Object3D()
        this.links.container.matrixAutoUpdate = false
        this.container.add(this.links.container)

        // Options
        this.links.options = [
            {
                href: 'https://github.com/RSimmons2021',
                kind: 'github', label: 'GitHub',
                labelTexture: this.resources.items.informationContactGithubLabelTexture
            },
            {
                href: 'https://www.linkedin.com/in/richard-simmons-a3916958',
                kind: 'linkedin', label: 'LinkedIn',
                labelTexture: this.resources.items.informationContactLinkedinLabelTexture
            },
            {
                href: 'mailto:richard.simmons.dev@gmail.com',
                kind: 'email', label: 'Email',
                labelTexture: this.resources.items.informationContactMailLabelTexture
            },
            {
                href: 'https://richard-simmons-portfolio.vercel.app',
                kind: 'portfolio', label: 'Portfolio',
                labelTexture: this.resources.items.informationContactTwitterLabelTexture
            }
        ]

        // Create each link
        let i = 0
        for(const _option of this.links.options)
        {
            // Set up
            const item = {}
            item.x = this.x + this.links.x + this.links.distanceBetween * i
            item.y = this.y + this.links.y
            item.href = _option.href

            // Create area
            item.area = this.areas.add({
                position: new THREE.Vector2(item.x, item.y),
                halfExtents: new THREE.Vector2(this.links.halfExtents.x, this.links.halfExtents.y)
            })
            item.area.on('interact', () =>
            {
                window.open(_option.href, '_blank', 'noopener')
            })

            // Texture
            item.texture = _option.labelTexture
            item.texture.magFilter = THREE.NearestFilter
            item.texture.minFilter = THREE.LinearFilter

            // Create label
            item.labelMesh = new THREE.Mesh(this.links.labelGeometry, new THREE.MeshBasicMaterial({ wireframe: false, color: 0xffffff, alphaMap: _option.labelTexture, depthTest: true, depthWrite: false, transparent: true }))
            item.labelMesh.position.x = item.x + this.links.labelWidth * 0.5 - this.links.halfExtents.x
            item.labelMesh.position.y = item.y + this.links.labelOffset
            item.labelMesh.matrixAutoUpdate = false
            item.labelMesh.updateMatrix()
            this.links.container.add(item.labelMesh)

            const landmark = this.objects.getConvertedMesh(this.resources.items[`link${_option.kind}`].scene.children, { duplicated: true })
            landmark.name = `${_option.label} link landmark`
            landmark.position.set(item.x, item.y + 2.8, 0)
            this.links.container.add(landmark)
            const body = new CANNON.Body({ mass: 0 })
            body.addShape(new CANNON.Box(new CANNON.Vec3(0.95, 0.3, 1.15)))
            body.position.set(item.x, item.y + 2.8, 1.15)
            this.objects.physics.world.addBody(body)
            const canvas = document.createElement('canvas')
            canvas.width = 512
            canvas.height = 128
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#063e30'
            ctx.fillRect(0, 0, 512, 128)
            ctx.strokeStyle = '#f5faf3'
            ctx.lineWidth = 5
            ctx.strokeRect(7, 7, 498, 114)
            ctx.fillStyle = '#f5faf3'
            ctx.font = 'bold 58px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(_option.label, 256, 84)
            const texture = new THREE.CanvasTexture(canvas)
            texture.colorSpace = THREE.SRGBColorSpace
            item.labelMesh.material.dispose()
            item.labelMesh.material = new THREE.MeshBasicMaterial({ map: texture, depthWrite: false })

            // Save
            this.links.items.push(item)

            i++
        }
    }

    setTiles()
    {
        this.tiles.add({
            start: new THREE.Vector2(this.x - 1.2, this.y + 13),
            delta: new THREE.Vector2(0, - 20)
        })
    }
}
