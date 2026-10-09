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
                vec3 filterColor(vec2 uv){vec3 c=texture2D(tDiffuse,uv).rgb;
                    if(uThreshold>0.0){float l=max(max(c.r,c.g),c.b);float knee=0.35;
                        float soft=clamp(l-uThreshold+knee,0.0,knee*2.0);soft=soft*soft/(4.0*knee);
                        c*=max(l-uThreshold,soft)/max(l,0.001);}return c;}
                void main(){vec3 c=(filterColor(vUv+uTexel)+filterColor(vUv-uTexel)+
                    filterColor(vUv+vec2(uTexel.x,-uTexel.y))+filterColor(vUv+vec2(-uTexel.x,uTexel.y)))*0.25;
                    gl_FragColor=vec4(c,1.0);}` })
        this.quad = new FullScreenQuad(this.material)
        this.targets.forEach((target, i) => { composite.uniforms[`uBloom${i}`] = { value: target.texture } })
        composite.uniforms.uBloomLevels = { value: settings.bloom }
        composite.uniforms.uExposure = { value: 1 }
        composite.uniforms.uBloomStrength = { value: 1 }
        composite.fragmentShader = `uniform sampler2D tDiffuse; uniform float uVignetteIntensity;
            uniform sampler2D uBloom0; uniform sampler2D uBloom1; uniform sampler2D uBloom2; uniform sampler2D uBloom3; uniform sampler2D uBloom4;
            uniform float uBloomLevels; uniform float uExposure; uniform float uBloomStrength; varying vec2 vUv;
            vec3 aces(vec3 x){return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0);}
            vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
            void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;vec3 bloom=vec3(0.0);
                if(uBloomLevels>0.0) bloom+=texture2D(uBloom0,vUv).rgb*0.22;
                if(uBloomLevels>1.0) bloom+=texture2D(uBloom1,vUv).rgb*0.2;
                if(uBloomLevels>2.0) bloom+=texture2D(uBloom2,vUv).rgb*0.16;
                if(uBloomLevels>3.0) bloom+=texture2D(uBloom3,vUv).rgb*0.12;
                if(uBloomLevels>4.0) bloom+=texture2D(uBloom4,vUv).rgb*0.1;
                c=max((c+bloom*uBloomStrength)*uExposure,vec3(0.0));
                float peak=max(max(c.r,c.g),c.b);
                // Retain the hue of bright neon instead of turning red/cyan
                // bars white through independent-channel highlight clipping.
                c=mix(aces(c),c/max(peak,0.001)*aces(vec3(peak)),0.3);
                c=mix(c,c*vec3(0.96,1.01,1.025),0.2);
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
            this.uniforms.uThreshold.value = i === 0 ? 1.15 : 0
            renderer.setRenderTarget(this.targets[i])
            this.quad.render(renderer)
            input = this.targets[i]
        }
    }

    dispose() { this.targets.forEach(target => target.dispose()); this.material.dispose(); this.quad.dispose() }
}
