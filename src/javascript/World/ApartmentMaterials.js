import * as THREE from 'three'
import vertexShader from '../../shaders/cyber/vertex.glsl'
import fragmentShader from '../../shaders/apartment/fragment.glsl'

export default function apartmentMaterials(world, origin)
{
    const cyber = world.materials.cyber
    const atlas = new THREE.ShaderMaterial({ vertexShader, fragmentShader, defines: { HAS_AO: 1 },
        uniforms: { uAtlas: { value: cyber.atlas }, uMask: { value: cyber.mask },
            uRoomOrigin: { value: new THREE.Vector3(origin.x, origin.y, 0) }, uRevealProgress: { value: 1 } } })
    const windowTexture = world.resources.items.cyberApartmentWindowTexture
    windowTexture.colorSpace = THREE.SRGBColorSpace
    windowTexture.flipY = false
    windowTexture.needsUpdate = true
    const window = new THREE.MeshBasicMaterial({ map: windowTexture, color: '#c4e8ff', side: THREE.DoubleSide, toneMapped: false })

    const graphic = (poster) =>
    {
        const canvas = document.createElement('canvas')
        canvas.width = poster ? 512 : 768
        canvas.height = poster ? 640 : 448
        const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height
        ctx.fillStyle = '#08151e'; ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#123847'; ctx.lineWidth = 1
        for(let x = 24; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
        for(let y = 24; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
        ctx.fillStyle = '#78ffb2'; ctx.font = 'bold 28px monospace'
        ctx.fillText(poster ? 'AFTER HOURS' : 'HOME LAB // ONLINE', 32, 52)
        ctx.fillStyle = '#56c8e0'; ctx.font = '18px monospace'
        ctx.fillText(poster ? 'NEON DISTRICT / VOL. 01' : 'BUILD · LEARN · SHIP', 32, 88)
        if(poster)
        {
            ctx.strokeStyle = '#ff4baa'; ctx.lineWidth = 5
            for(let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(w / 2, h / 2, 30 + i * 21, 0, Math.PI * 2); ctx.stroke() }
            ctx.fillStyle = '#ffd997'; ctx.font = 'bold 34px monospace'; ctx.fillText('STAY CURIOUS', 32, h - 52)
        }
        else
        {
            ctx.font = '18px monospace'
            for(let i = 0; i < 10; i++)
            {
                ctx.fillStyle = i % 3 ? '#58a9ba' : '#ffd997'
                ctx.fillText(['> agent.connect(neonDistrict)', '  status: systems nominal', '  async build(nextIdea) {', '    await learn();', '    return ship();', '  }'][i % 6], 36 + (i % 3) * 12, 134 + i * 25)
            }
            ctx.fillStyle = '#78ffb2'; ctx.fillRect(w - 48, 28, 10, 10)
        }
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = false
        return new THREE.MeshBasicMaterial({ map: texture, color: poster ? '#a0aac2' : '#bbffff', side: THREE.DoubleSide, toneMapped: false })
    }
    return { nd_atlas: atlas, nd_window: window, nd_screen: graphic(false), nd_sign: graphic(true) }
}
