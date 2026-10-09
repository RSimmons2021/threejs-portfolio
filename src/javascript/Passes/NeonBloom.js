import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'

export default class NeonBloom extends Pass
{
    constructor(settings, composite)
    {
        super()
        this.needsSwap = false
        this.settings = settings
        this.composite = composite
        this.targets = Array.from({ length: 5 }, () => new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false
        }))
        this.uniforms = { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 } }
        this.material = new THREE.ShaderMaterial({ uniforms: this.uniforms, depthTest: false, depthWrite: false,
            vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
            fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
                void main(){vec3 c=(texture2D(tDiffuse,vUv+uTexel).rgb+texture2D(tDiffuse,vUv-uTexel).rgb+
                    texture2D(tDiffuse,vUv+vec2(uTexel.x,-uTexel.y)).rgb+texture2D(tDiffuse,vUv+vec2(-uTexel.x,uTexel.y)).rgb)*0.25;
                    if(uThreshold>0.0){float l=max(max(c.r,c.g),c.b);c*=max(0.0,l-uThreshold)/max(l,0.001);} gl_FragColor=vec4(c,1.0);}` })
        this.quad = new FullScreenQuad(this.material)
        this.targets.forEach((target, i) => { composite.uniforms[`uBloom${i}`] = { value: target.texture } })
        composite.uniforms.uBloomLevels = { value: settings.bloom }
        composite.fragmentShader = `uniform sampler2D tDiffuse; uniform float uVignetteIntensity;
            uniform sampler2D uBloom0; uniform sampler2D uBloom1; uniform sampler2D uBloom2; uniform sampler2D uBloom3; uniform sampler2D uBloom4;
            uniform float uBloomLevels; varying vec2 vUv;
            vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
            vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
            void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec3 bloom=vec3(0.0);
                if(uBloomLevels>0.0) bloom+=texture2D(uBloom0,vUv).rgb*0.22;
                if(uBloomLevels>1.0) bloom+=texture2D(uBloom1,vUv).rgb*0.2;
                if(uBloomLevels>2.0) bloom+=texture2D(uBloom2,vUv).rgb*0.16;
                if(uBloomLevels>3.0) bloom+=texture2D(uBloom3,vUv).rgb*0.12;
                if(uBloomLevels>4.0) bloom+=texture2D(uBloom4,vUv).rgb*0.1;
                c=aces(c+bloom);c=mix(c,c*vec3(0.93,1.02,1.04),0.24);c+=vec3(0.003,0.005,0.006);
                float edge=smoothstep(0.2,0.85,length(vUv-0.5));c*=1.0-edge*min(uVignetteIntensity,0.3);
                gl_FragColor=vec4(srgb(c),1.0);}`
        composite.needsUpdate = true
        this.setQuality(settings)
    }

    setQuality(settings)
    {
        this.settings = settings
        this.composite.uniforms.uBloomLevels.value = settings.bloom
        if(this.width) this.setSize(this.width, this.height)
    }

    setSize(width, height)
    {
        this.width = width; this.height = height
        const divisor = this.settings.bloom >= 5 ? 2 : 4
        this.targets.forEach((target, i) => target.setSize(Math.max(1, Math.round(width / divisor / 2 ** i)), Math.max(1, Math.round(height / divisor / 2 ** i))))
    }

    render(renderer, writeBuffer, readBuffer)
    {
        if(!this.settings.bloom) return
        let input = readBuffer
        for(let i = 0; i < this.settings.bloom; i++)
        {
            this.uniforms.tDiffuse.value = input.texture
            this.uniforms.uTexel.value.set(1.4 / input.width, 1.4 / input.height)
            this.uniforms.uThreshold.value = i === 0 ? 1.25 : 0
            renderer.setRenderTarget(this.targets[i])
            this.quad.render(renderer)
            input = this.targets[i]
        }
    }

    dispose() { this.targets.forEach(target => target.dispose()); this.material.dispose(); this.quad.dispose() }
}
