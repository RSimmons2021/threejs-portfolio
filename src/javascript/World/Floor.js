import * as THREE from 'three'
import FloorMaterial from '../Materials/Floor.js'

export default class Floor
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Geometry
        this.geometry = new THREE.PlaneGeometry(2, 2, 10, 10)

        // Colors - Changed to olive/sage green and beige tones
        this.colors = {}
        this.colors.topLeft = '#8B9B7A'      // Sage green
        this.colors.topRight = '#7A8A69'     // Olive green
        this.colors.bottomRight = '#D4C5B0'  // Beige
        this.colors.bottomLeft = '#B8A999'   // Tan

        // Material
        this.material = new FloorMaterial()
        this.material.uniforms.uWetness.value = 0
        this.tempTopLeft = new THREE.Color()
        this.tempTopRight = new THREE.Color()
        this.tempBottomRight = new THREE.Color()
        this.tempBottomLeft = new THREE.Color()

        // Keep one texture and update bytes in place to avoid allocations
        this.backgroundData = new Uint8Array(2 * 2 * 4)
        this.backgroundTexture = new THREE.DataTexture(this.backgroundData, 2, 2)
        this.backgroundTexture.magFilter = THREE.LinearFilter
        this.backgroundTexture.minFilter = THREE.LinearFilter
        this.backgroundTexture.needsUpdate = true
        this.material.uniforms.tBackground.value = this.backgroundTexture

        // Direct Color-object path (no hex-string round-trip) used by the day/night cycle
        this.setColors = (_topLeft, _topRight, _bottomRight, _bottomLeft) =>
        {
            this.tempTopLeft.copy(_topLeft)
            this.tempTopRight.copy(_topRight)
            this.tempBottomRight.copy(_bottomRight)
            this.tempBottomLeft.copy(_bottomLeft)

            this.writeColors()
        }

        this.updateMaterial = () =>
        {
            this.tempTopLeft.set(this.colors.topLeft)
            this.tempTopRight.set(this.colors.topRight)
            this.tempBottomRight.set(this.colors.bottomRight)
            this.tempBottomLeft.set(this.colors.bottomLeft)

            this.writeColors()
        }

        this.writeColors = () =>
        {
            const topLeft = this.tempTopLeft
            const topRight = this.tempTopRight
            const bottomRight = this.tempBottomRight
            const bottomLeft = this.tempBottomLeft

            topLeft.convertLinearToSRGB()
            topRight.convertLinearToSRGB()
            bottomRight.convertLinearToSRGB()
            bottomLeft.convertLinearToSRGB()

            this.backgroundData[0] = Math.round(bottomLeft.r * 255)
            this.backgroundData[1] = Math.round(bottomLeft.g * 255)
            this.backgroundData[2] = Math.round(bottomLeft.b * 255)
            this.backgroundData[3] = 255

            this.backgroundData[4] = Math.round(bottomRight.r * 255)
            this.backgroundData[5] = Math.round(bottomRight.g * 255)
            this.backgroundData[6] = Math.round(bottomRight.b * 255)
            this.backgroundData[7] = 255

            this.backgroundData[8] = Math.round(topLeft.r * 255)
            this.backgroundData[9] = Math.round(topLeft.g * 255)
            this.backgroundData[10] = Math.round(topLeft.b * 255)
            this.backgroundData[11] = 255

            this.backgroundData[12] = Math.round(topRight.r * 255)
            this.backgroundData[13] = Math.round(topRight.g * 255)
            this.backgroundData[14] = Math.round(topRight.b * 255)
            this.backgroundData[15] = 255

            this.backgroundTexture.needsUpdate = true
        }

        this.updateMaterial()

        // Mesh
        this.mesh = new THREE.Mesh(this.geometry, this.material)
        this.mesh.frustumCulled = false
        this.mesh.matrixAutoUpdate = false
        this.mesh.updateMatrix()
        this.container.add(this.mesh)

        this.setWetness = (_value) =>
        {
            this.material.uniforms.uWetness.value = Math.min(Math.max(_value, 0), 1)
        }

        if(this.time)
        {
            this.time.on('tick', () =>
            {
                this.material.uniforms.uTime.value = this.time.elapsed
            })
        }

        // Debug
        if(this.debug)
        {
            const folder = this.debug.addFolder('floor')
            // folder.open()

            folder.addColor(this.colors, 'topLeft').onChange(this.updateMaterial)
            folder.addColor(this.colors, 'topRight').onChange(this.updateMaterial)
            folder.addColor(this.colors, 'bottomRight').onChange(this.updateMaterial)
            folder.addColor(this.colors, 'bottomLeft').onChange(this.updateMaterial)
        }
    }
}
