import restart from 'vite-plugin-restart'
import glsl from 'vite-plugin-glsl'

export default {
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
        sourcemap: true, // Add sourcemap
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
                    if(!id.includes('node_modules'))
                    {
                        return null
                    }

                    if(id.includes('three/examples/jsm'))
                    {
                        return 'three-extras'
                    }

                    if(id.includes('three'))
                    {
                        return 'three-vendor'
                    }

                    if(id.includes('cannon'))
                    {
                        return 'physics-vendor'
                    }

                    if(id.includes('gsap'))
                    {
                        return 'animation-vendor'
                    }

                    if(id.includes('howler'))
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
        restart({ restart: [ '../static/**', ] }) // Restart server on static file change
    ],
}
