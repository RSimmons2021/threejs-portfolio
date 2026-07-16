import * as THREE from 'three'

/**
 * "Echo of your last visit": records the visitor's drive (position + heading
 * at 8Hz, capped) into localStorage and, on the next visit, replays the
 * previous session's path as a translucent ghost car.
 */
export default class VisitGhost
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.physics = _options.physics
        this.debug = _options.debug

        // Container
        this.container = new THREE.Object3D()
        this.container.matrixAutoUpdate = false

        // Settings
        this.settings = {}
        this.settings.enabled = true
        this.settings.sampleInterval = 125 // ms -> 8Hz
        this.settings.maxSamples = 1440 // = 3 minutes of driving
        this.settings.minSamplesToReplay = 80 // ~10s of movement, or don't bother
        this.settings.storageKey = 'portfolio-last-visit-path'

        // Recording state
        this.recording = []
        this.timeSinceLastSample = 0
        this.timeSinceLastSave = 0

        // Replay state
        this.replayPath = this.loadPath()
        this.replayIndex = 0
        this.replayProgress = 0

        if(this.replayPath)
        {
            this.setModel()
        }

        // Persist when the tab hides (mobile-safe) and periodically as a fallback
        document.addEventListener('visibilitychange', () =>
        {
            if(document.hidden)
            {
                this.savePath()
            }
        })

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('visitGhost')
            this.debugFolder.add(this.settings, 'enabled').name('enabled')
            this.debugFolder.add(this, 'clearStoredPath').name('clear recording')
        }
    }

    loadPath()
    {
        try
        {
            const raw = window.localStorage.getItem(this.settings.storageKey)
            if(!raw)
            {
                return null
            }

            const parsed = JSON.parse(raw)
            if(!parsed || !Array.isArray(parsed.samples) || parsed.samples.length < this.settings.minSamplesToReplay)
            {
                return null
            }

            return parsed.samples
        }
        catch(_error)
        {
            return null
        }
    }

    savePath()
    {
        if(this.recording.length < this.settings.minSamplesToReplay)
        {
            return
        }

        try
        {
            window.localStorage.setItem(this.settings.storageKey, JSON.stringify({ version: 1, samples: this.recording }))
        }
        catch(_error)
        {
            // Storage full or blocked: silently skip
        }
    }

    clearStoredPath()
    {
        try
        {
            window.localStorage.removeItem(this.settings.storageKey)
        }
        catch(_error)
        {
            // ignore
        }
    }

    setModel()
    {
        // Simple translucent "echo" car: chassis box + cabin, no wheels needed
        this.material = new THREE.MeshBasicMaterial({
            color: '#9fd2ff',
            transparent: true,
            opacity: 0.16,
            depthWrite: false
        })

        this.model = new THREE.Group()

        const body = new THREE.Mesh(new THREE.BoxGeometry(2.02, 1.07, 0.55), this.material)
        body.position.z = 0.42
        this.model.add(body)

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.98, 0.5), this.material)
        cabin.position.set(- 0.25, 0, 0.92)
        this.model.add(cabin)

        this.container.add(this.model)
    }

    update()
    {
        if(!this.settings.enabled)
        {
            return
        }

        const car = this.physics && this.physics.car
        const chassisBody = car && car.chassis ? car.chassis.body : null
        if(!chassisBody)
        {
            return
        }

        const delta = Math.min(this.time.delta, 60)

        // Record this visit
        if(this.recording.length < this.settings.maxSamples)
        {
            this.timeSinceLastSample += delta
            if(this.timeSinceLastSample >= this.settings.sampleInterval)
            {
                this.timeSinceLastSample = 0
                this.recording.push([
                    Math.round(chassisBody.position.x * 100) / 100,
                    Math.round(chassisBody.position.y * 100) / 100,
                    Math.round((car.angle || 0) * 100) / 100
                ])
            }
        }

        // Periodic save fallback (visibilitychange doesn't always fire)
        this.timeSinceLastSave += delta
        if(this.timeSinceLastSave > 15000)
        {
            this.timeSinceLastSave = 0
            this.savePath()
        }

        // Replay the previous visit
        if(!this.replayPath || !this.model)
        {
            return
        }

        this.replayProgress += delta / this.settings.sampleInterval
        while(this.replayProgress >= 1)
        {
            this.replayProgress -= 1
            this.replayIndex++
        }

        // Loop with a small rest at the start
        if(this.replayIndex >= this.replayPath.length - 1)
        {
            this.replayIndex = 0
            this.replayProgress = 0
        }

        const current = this.replayPath[this.replayIndex]
        const next = this.replayPath[this.replayIndex + 1]
        const t = this.replayProgress

        this.model.position.x = current[0] + (next[0] - current[0]) * t
        this.model.position.y = current[1] + (next[1] - current[1]) * t

        // Shortest-path angle interpolation
        let angleDelta = next[2] - current[2]
        if(angleDelta > Math.PI) angleDelta -= Math.PI * 2
        if(angleDelta < - Math.PI) angleDelta += Math.PI * 2
        this.model.rotation.z = current[2] + angleDelta * t

        // Fade the ghost out when the real car is close (avoid visual clutter)
        const distanceX = this.model.position.x - chassisBody.position.x
        const distanceY = this.model.position.y - chassisBody.position.y
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)
        this.material.opacity = 0.16 * Math.min(distance / 4, 1)
    }
}
