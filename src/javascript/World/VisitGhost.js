import * as THREE from 'three'

/**
 * "Echo of your last visit": records the visitor's drive (position + heading
 * at 8Hz, capped) into localStorage and, on the next visit, replays the
 * previous session's path as a translucent ghost car. Version 2 adds
 * playback controls, metadata and compact share links.
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
        this.settings.maxShareSamples = 180

        // Recording state
        this.recording = []
        this.timeSinceLastSample = 0
        this.timeSinceLastSave = 0
        this.recordingDistance = 0
        this.recordingTopSpeed = 0
        this.lastRecordedPosition = null

        // Replay state
        this.replayData = this.loadReplay()
        this.replayPath = this.replayData ? this.replayData.samples : null
        this.replayIndex = 0
        this.replayProgress = 0
        this.playback = {
            playing: true,
            speed: 1,
            visible: true,
            watching: false
        }

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

    loadReplay()
    {
        const shared = new URLSearchParams(window.location.search).get('ghost')
        if(shared)
        {
            try
            {
                let base64 = shared.replace(/-/g, '+').replace(/_/g, '/')
                base64 += '='.repeat((4 - base64.length % 4) % 4)
                const decoded = JSON.parse(window.atob(base64))
                if(decoded && Array.isArray(decoded.samples) && decoded.samples.length >= 2)
                {
                    return {
                        version: 2,
                        shared: true,
                        recordedAt: decoded.recordedAt || null,
                        duration: decoded.duration || decoded.samples.length * this.settings.sampleInterval,
                        distance: decoded.distance || 0,
                        topSpeed: decoded.topSpeed || 0,
                        samples: decoded.samples
                    }
                }
            }
            catch(_error)
            {
                // Ignore invalid shared routes and fall back to the visitor's local replay.
            }
        }

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

            return {
                version: parsed.version || 1,
                shared: false,
                recordedAt: parsed.recordedAt || null,
                duration: parsed.duration || parsed.samples.length * this.settings.sampleInterval,
                distance: parsed.distance || 0,
                topSpeed: parsed.topSpeed || 0,
                samples: parsed.samples
            }
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
            window.localStorage.setItem(this.settings.storageKey, JSON.stringify({
                version: 2,
                recordedAt: new Date().toISOString(),
                duration: this.recording.length * this.settings.sampleInterval,
                distance: Math.round(this.recordingDistance * 10) / 10,
                topSpeed: this.recordingTopSpeed,
                samples: this.recording
            }))
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

    hasReplay()
    {
        return Boolean(this.replayPath && this.model)
    }

    play()
    {
        if(this.hasReplay())
        {
            this.playback.playing = true
            this.playback.visible = true
            this.model.visible = true
        }
    }

    pause()
    {
        this.playback.playing = false
    }

    restart()
    {
        this.replayIndex = 0
        this.replayProgress = 0
        this.play()
    }

    setPlaybackSpeed(_speed)
    {
        const allowed = [0.5, 1, 2]
        this.playback.speed = allowed.includes(_speed) ? _speed : 1
    }

    setVisible(_visible)
    {
        this.playback.visible = Boolean(_visible)
        if(this.model)
        {
            this.model.visible = this.playback.visible
        }
    }

    getStatus()
    {
        const length = this.replayPath ? this.replayPath.length : 0
        const progress = length > 1 ? (this.replayIndex + this.replayProgress) / (length - 1) : 0
        return {
            available: this.hasReplay(),
            playing: this.playback.playing,
            watching: this.playback.watching,
            speed: this.playback.speed,
            progress: Math.min(Math.max(progress, 0), 1),
            duration: this.replayData ? this.replayData.duration : 0,
            distance: this.replayData ? this.replayData.distance : 0,
            shared: Boolean(this.replayData && this.replayData.shared)
        }
    }

    getShareUrl()
    {
        if(!this.replayData || !this.replayPath)
        {
            return null
        }

        const stride = Math.max(Math.ceil(this.replayPath.length / this.settings.maxShareSamples), 1)
        const samples = []
        for(let i = 0; i < this.replayPath.length; i += stride)
        {
            samples.push(this.replayPath[i])
        }
        if(samples[samples.length - 1] !== this.replayPath[this.replayPath.length - 1])
        {
            samples.push(this.replayPath[this.replayPath.length - 1])
        }

        const payload = {
            version: 2,
            recordedAt: this.replayData.recordedAt,
            duration: this.replayData.duration,
            distance: this.replayData.distance,
            topSpeed: this.replayData.topSpeed,
            samples
        }
        const encoded = window.btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
        const url = new URL(window.location.href)
        url.searchParams.set('ghost', encoded)
        url.hash = ''
        return url.toString()
    }

    async copyShareUrl()
    {
        const url = this.getShareUrl()
        if(!url || !navigator.clipboard)
        {
            return false
        }

        try
        {
            await navigator.clipboard.writeText(url)
            return true
        }
        catch(_error)
        {
            return false
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
                    Math.round((car.angle || 0) * 100) / 100,
                    Math.round(Math.abs(car.speed || 0) * 10000) / 10000
                ])

                if(this.lastRecordedPosition)
                {
                    const deltaX = chassisBody.position.x - this.lastRecordedPosition.x
                    const deltaY = chassisBody.position.y - this.lastRecordedPosition.y
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
                    if(distance < 4)
                    {
                        this.recordingDistance += distance
                    }
                }
                else
                {
                    this.lastRecordedPosition = new THREE.Vector2()
                }
                this.lastRecordedPosition.set(chassisBody.position.x, chassisBody.position.y)
                this.recordingTopSpeed = Math.max(this.recordingTopSpeed, Math.abs(car.speed || 0))
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

        if(!this.playback.playing)
        {
            return
        }

        const replaySampleInterval = this.replayData && this.replayPath.length > 1
            ? this.replayData.duration / (this.replayPath.length - 1)
            : this.settings.sampleInterval
        this.replayProgress += delta * this.playback.speed / Math.max(replaySampleInterval, 1)
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
