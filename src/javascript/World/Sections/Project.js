import * as THREE from 'three'

import ProjectBoardMaterial from '../../Materials/ProjectBoard.js'
import gsap from 'gsap'

export default class Project
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.resources = _options.resources
        this.objects = _options.objects
        this.areas = _options.areas
        this.name = _options.name
        this.geometries = _options.geometries
        this.meshes = _options.meshes
        this.debug = _options.debug
        this.x = _options.x
        this.y = _options.y
        this.imageSources = _options.imageSources
        this.floorTexture = _options.floorTexture
        this.link = _options.link
        this.details = _options.details || {}
        this.theme = _options.theme || {}
        this.prototype = _options.prototype || null
        this.story = _options.story || null
        this.portalHandler = null

        // Set up
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false
        // this.container.updateMatrix()

        this.setBoards()
        this.setFloor()
        this.setPortalBeacon()
    }

    setBoards()
    {
        // Set up
        this.boards = {}
        this.boards.items = []
        this.boards.xStart = - 5
        this.boards.xInter = 5
        this.boards.y = 5
        this.boards.color = '#8e7161'
        this.boards.threeColor = new THREE.Color(this.boards.color)

        if(this.debug)
        {
            this.debug.addColor(this.boards, 'color').name('boardColor').onChange(() =>
            {
                this.boards.threeColor.set(this.boards.color)
            })
        }

        // Create each board
        let i = 0

        for(const _imageSource of this.imageSources)
        {
            // Set up
            const board = {}
            board.x = this.x + this.boards.xStart + i * this.boards.xInter
            board.y = this.y + this.boards.y

            // Create structure with collision
            this.objects.add({
                base: this.resources.items.projectsBoardStructure.scene,
                collision: this.resources.items.projectsBoardCollision.scene,
                floorShadowTexture: this.resources.items.projectsBoardStructureFloorShadowTexture,
                offset: new THREE.Vector3(board.x, board.y, 0),
                rotation: new THREE.Euler(0, 0, 0),
                duplicated: true,
                mass: 0
            })

            // Image load
            const image = new Image()
            image.addEventListener('load', () =>
            {
                board.texture = new THREE.Texture(image)
                // board.texture.magFilter = THREE.NearestFilter
                // board.texture.minFilter = THREE.LinearFilter
                board.texture.anisotropy = 4
                // board.texture.colorSpace = THREE.SRGBColorSpace
                board.texture.needsUpdate = true

                board.planeMesh.material.uniforms.uTexture.value = board.texture

                gsap.to(board.planeMesh.material.uniforms.uTextureAlpha, { value: 1, duration: 1, ease: 'power4.inOut' })
            })

            image.src = _imageSource

            // Plane
            board.planeMesh = this.meshes.boardPlane.clone()
            board.planeMesh.position.x = board.x
            board.planeMesh.position.y = board.y
            board.planeMesh.matrixAutoUpdate = false
            board.planeMesh.updateMatrix()
            board.planeMesh.material = new ProjectBoardMaterial()
            board.planeMesh.material.uniforms.uColor.value = this.boards.threeColor
            board.planeMesh.material.uniforms.uTextureAlpha.value = 0
            this.container.add(board.planeMesh)

            // Save
            this.boards.items.push(board)

            i++
        }
    }

    setFloor()
    {
        this.floor = {}

        this.floor.x = 0
        this.floor.y = - 2

        // Container
        this.floor.container = new THREE.Object3D()
        this.floor.container.position.x = this.x + this.floor.x
        this.floor.container.position.y = this.y + this.floor.y
        this.floor.container.matrixAutoUpdate = false
        this.floor.container.updateMatrix()
        this.container.add(this.floor.container)

        // Texture - only create if floor texture exists
        if(this.floorTexture)
        {
            this.floor.texture = this.floorTexture
            this.floor.texture.magFilter = THREE.NearestFilter
            this.floor.texture.minFilter = THREE.LinearFilter

            // Geometry
            this.floor.geometry = this.geometries.floor

            // Material
            this.floor.material =  new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, alphaMap: this.floor.texture })

            // Mesh
            this.floor.mesh = new THREE.Mesh(this.floor.geometry, this.floor.material)
            this.floor.mesh.matrixAutoUpdate = false
            this.floor.container.add(this.floor.mesh)
        }

        // Area
        this.floor.area = this.areas.add({
            position: new THREE.Vector2(this.x + this.link.x, this.y + this.floor.y + this.link.y),
            halfExtents: new THREE.Vector2(this.link.halfExtents.x, this.link.halfExtents.y)
        })
        this.floor.area.on('interact', () =>
        {
            if(this.portalHandler)
            {
                this.portalHandler(this)
                return
            }

            window.open(this.link.href, '_blank', 'noopener')
        })

        // Area label
        this.floor.areaLabel = this.meshes.areaLabel.clone()
        this.floor.areaLabel.position.x = this.link.x
        this.floor.areaLabel.position.y = this.link.y
        this.floor.areaLabel.position.z = 0.001
        this.floor.areaLabel.matrixAutoUpdate = false
        this.floor.areaLabel.updateMatrix()
        this.floor.container.add(this.floor.areaLabel)

        // Project name/description text
        this.setProjectDescription()
    }

    setPortalHandler(_handler)
    {
        this.portalHandler = typeof _handler === 'function' ? _handler : null
    }

    setPortalBeacon()
    {
        const accent = this.theme.accent || '#8ed4ff'

        this.portalBeacon = {}
        this.portalBeacon.geometry = new THREE.RingGeometry(2.15, 2.5, 48)
        this.portalBeacon.material = new THREE.MeshBasicMaterial({
            color: accent,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        })
        this.portalBeacon.mesh = new THREE.Mesh(this.portalBeacon.geometry, this.portalBeacon.material)
        this.portalBeacon.mesh.position.set(
            this.x + this.floor.x + this.link.x,
            this.y + this.floor.y + this.link.y,
            0.025
        )
        this.portalBeacon.mesh.matrixAutoUpdate = true
        this.container.add(this.portalBeacon.mesh)

        this.time.on('tick', () =>
        {
            const pulse = 1 + Math.sin(this.time.elapsed * 0.0025) * 0.08
            this.portalBeacon.mesh.scale.setScalar(pulse)
            this.portalBeacon.mesh.rotation.z += this.time.delta * 0.00018
            this.portalBeacon.material.opacity = this.floor.area.isIn ? 0.58 : 0.22
        })
    }

    setProjectDescription()
    {
        const canvas = document.createElement('canvas')
        canvas.width = 1600
        canvas.height = 900
        const context = canvas.getContext('2d')
        let texture = null

        const details = {
            eyebrow: 'Featured project',
            role: 'Product design + engineering',
            problem: '',
            built: '',
            stack: '',
            outcome: '',
            ...this.details
        }

        const drawTag = (_text, _x, _y, _color) =>
        {
            const paddingX = 22
            context.font = '600 27px Amulya, Arial, sans-serif'
            const width = context.measureText(_text).width + paddingX * 2
            context.fillStyle = 'rgba(255, 255, 255, 0.1)'
            context.strokeStyle = _color
            context.lineWidth = 2
            context.beginPath()
            this.roundRect(context, _x, _y, width, 48, 24)
            context.fill()
            context.stroke()
            context.fillStyle = '#f8fbff'
            context.fillText(_text, _x + paddingX, _y + 33)
            return width
        }

        const drawSection = (_label, _text, _x, _y, _maxWidth, _maxLines = 3) =>
        {
            context.fillStyle = '#8ed4ff'
            context.font = '700 27px Amulya, Arial, sans-serif'
            context.fillText(_label.toUpperCase(), _x, _y)

            context.fillStyle = '#eff8ff'
            context.font = '400 34px Amulya, Arial, sans-serif'
            this.wrapText(context, _text, _x, _y + 46, _maxWidth, 43, _maxLines)
        }

        const draw = () =>
        {
            context.clearRect(0, 0, canvas.width, canvas.height)

            const background = context.createLinearGradient(0, 0, canvas.width, canvas.height)
            background.addColorStop(0, '#101923')
            background.addColorStop(0.52, '#182e3f')
            background.addColorStop(1, '#0a1018')
            context.fillStyle = background
            context.fillRect(0, 0, canvas.width, canvas.height)

            context.fillStyle = 'rgba(142, 212, 255, 0.12)'
            context.beginPath()
            context.arc(1320, 80, 420, 0, Math.PI * 2)
            context.fill()

            context.fillStyle = 'rgba(255, 255, 255, 0.06)'
            context.fillRect(0, 0, canvas.width, 12)

            context.textAlign = 'left'
            context.textBaseline = 'alphabetic'

            context.fillStyle = '#9adfff'
            context.font = '700 31px Amulya, Arial, sans-serif'
            context.fillText(details.eyebrow.toUpperCase(), 84, 96)

            context.fillStyle = '#ffffff'
            context.font = '700 104px Amulya, Arial, sans-serif'
            context.fillText(this.name, 80, 212)

            const roleWidth = drawTag(details.role, 88, 250, 'rgba(142, 212, 255, 0.72)')
            drawTag('Open live project', 112 + roleWidth, 250, 'rgba(242, 204, 148, 0.76)')

            const columnWidth = 650
            drawSection('Problem', details.problem, 88, 390, columnWidth, 3)
            drawSection('Built', details.built, 88, 620, columnWidth, 3)
            drawSection('Stack', details.stack, 860, 390, 610, 4)
            drawSection('Outcome', details.outcome, 860, 620, 610, 3)

            context.fillStyle = 'rgba(242, 204, 148, 0.9)'
            context.fillRect(88, 805, 300, 5)
            context.fillStyle = 'rgba(142, 212, 255, 0.9)'
            context.fillRect(398, 805, 118, 5)

            if(texture)
            {
                texture.needsUpdate = true
            }
        }

        draw()

        texture = new THREE.CanvasTexture(canvas)
        texture.magFilter = THREE.NearestFilter
        texture.minFilter = THREE.LinearFilter
        texture.colorSpace = THREE.SRGBColorSpace

        if(document.fonts)
        {
            Promise.all([
                document.fonts.load('700 104px Amulya'),
                document.fonts.load('400 34px Amulya'),
                document.fonts.load('600 27px Amulya')
            ]).then(draw).catch(() => {})
        }

        // Create plane geometry and material
        const geometry = new THREE.PlaneGeometry(12.8, 7.2)
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false
        })

        // Create mesh
        this.floor.descriptionMesh = new THREE.Mesh(geometry, material)
        this.floor.descriptionMesh.position.x = 0
        this.floor.descriptionMesh.position.y = 0.75
        this.floor.descriptionMesh.position.z = 0.002
        this.floor.descriptionMesh.matrixAutoUpdate = false
        this.floor.descriptionMesh.updateMatrix()
        this.floor.container.add(this.floor.descriptionMesh)
    }

    wrapText(_context, _text, _x, _y, _maxWidth, _lineHeight, _maxLines = 4)
    {
        const words = `${_text}`.split(' ')
        let line = ''
        let lineCount = 0

        for(let i = 0; i < words.length; i++)
        {
            const testLine = line ? `${line} ${words[i]}` : words[i]
            const metrics = _context.measureText(testLine)

            if(metrics.width > _maxWidth && line)
            {
                _context.fillText(line, _x, _y + lineCount * _lineHeight)
                line = words[i]
                lineCount++

                if(lineCount >= _maxLines)
                {
                    return
                }
            }
            else
            {
                line = testLine
            }
        }

        if(line && lineCount < _maxLines)
        {
            _context.fillText(line, _x, _y + lineCount * _lineHeight)
        }
    }

    roundRect(_context, _x, _y, _width, _height, _radius)
    {
        const radius = Math.min(_radius, _width * 0.5, _height * 0.5)
        _context.moveTo(_x + radius, _y)
        _context.lineTo(_x + _width - radius, _y)
        _context.quadraticCurveTo(_x + _width, _y, _x + _width, _y + radius)
        _context.lineTo(_x + _width, _y + _height - radius)
        _context.quadraticCurveTo(_x + _width, _y + _height, _x + _width - radius, _y + _height)
        _context.lineTo(_x + radius, _y + _height)
        _context.quadraticCurveTo(_x, _y + _height, _x, _y + _height - radius)
        _context.lineTo(_x, _y + radius)
        _context.quadraticCurveTo(_x, _y, _x + radius, _y)
        _context.closePath()
    }
}
