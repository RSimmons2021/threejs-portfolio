import restart from 'vite-plugin-restart'
import glsl from 'vite-plugin-glsl'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const excludedPublicBuildFiles = [
    'social/share_richard.png',
    'draco/README.md',
    'draco/draco_decoder.js',
    'draco/draco_decoder.wasm',
    'draco/draco_encoder.js',
    'draco/draco_wasm_wrapper.js',
    'draco/gltf/draco_decoder.js',
    'draco/gltf/draco_encoder.js'
]

const pruneUnusedPublicBuildFiles = () =>
{
    return {
        name: 'prune-unused-public-build-files',
        apply: 'build',
        enforce: 'post',
        async closeBundle()
        {
            const outDir = resolve(process.cwd(), 'dist')
            await Promise.all(excludedPublicBuildFiles.map((_file) => rm(resolve(outDir, _file), { force: true })))
        }
    }
}

const getPackageName = (_id) =>
{
    const normalizedId = _id.replace(/\\/g, '/')
    const nodeModulesPath = normalizedId.split('/node_modules/')[1]

    if(!nodeModulesPath)
    {
        return null
    }

    const parts = nodeModulesPath.split('/')
    return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]
}

export default defineConfig({
    root: 'src/', // Sources files (typically where index.html is)
    publicDir: '../static/', // Path from "root" to static assets (files that are served as they are)
    server:
    {
        host: true, // Open to local network and display URL
        open: !('SANDBOX_URL' in process.env || 'CODESANDBOX_HOST' in process.env) // Open if it's not a CodeSandbox
    },
    build:
    {
        outDir: '../dist', // Output in the dist/ folder
        emptyOutDir: true, // Empty the folder first
        sourcemap: false,
        target: 'es2020',
        // THREE.js core is ~600kb minified on its own; splitting the examples/jsm
        // helpers into their own chunk keeps the core lean and lets the warning
        // limit reflect a realistic baseline for a Three.js portfolio.
        chunkSizeWarningLimit: 900,
        rollupOptions:
        {
            output:
            {
                manualChunks(id)
                {
                    const normalizedId = id.replace(/\\/g, '/')
                    const packageName = getPackageName(normalizedId)

                    if(!packageName)
                    {
                        return null
                    }

                    if(normalizedId.includes('/node_modules/three/examples/jsm/'))
                    {
                        return 'three-extras'
                    }

                    if(packageName === 'three')
                    {
                        return 'three-vendor'
                    }

                    if(packageName === 'cannon')
                    {
                        return 'physics-vendor'
                    }

                    if(packageName === 'gsap')
                    {
                        return 'animation-vendor'
                    }

                    if(packageName === 'howler')
                    {
                        return 'audio-vendor'
                    }

                    return 'vendor'
                }
            }
        }
    },
    plugins:
    [
        glsl(), // Support GLSL files
        restart({ restart: [ '../static/**', ] }), // Restart server on static file change
        pruneUnusedPublicBuildFiles()
    ],
})
