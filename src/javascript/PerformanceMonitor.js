export function summarizeFrames(frames)
{
    if(!frames.length) return null
    const sorted = [...frames].sort((a, b) => a - b)
    const mean = frames.reduce((a, b) => a + b, 0) / frames.length
    const worst = sorted.slice(-Math.max(1, Math.ceil(sorted.length * 0.01)))
    return { frames: frames.length, averageFps: 1000 / mean, averageMs: mean,
        p95Ms: sorted[Math.floor((sorted.length - 1) * 0.95)],
        onePercentLow: 1000 / (worst.reduce((a, b) => a + b, 0) / worst.length) }
}

export default class PerformanceMonitor
{
    constructor(app)
    {
        this.app = app
        this.frames = []
        this.lastUpdate = 0
        this.params = new URLSearchParams(location.search)
        this.panel = document.createElement('section')
        this.panel.className = 'performance-monitor'
        this.panel.setAttribute('aria-label', 'Graphics performance')
        this.panel.hidden = !this.params.has('perf') && !this.params.has('bench')
        this.panel.innerHTML = '<strong>NEON DISTRICT / PERFORMANCE</strong><output></output><label>Quality <select aria-label="Graphics quality"><option>low</option><option>medium</option><option>high</option><option>ultra</option></select></label><button type="button">Run 60s benchmark</button><small></small>'
        document.body.appendChild(this.panel)
        this.output = this.panel.querySelector('output')
        this.select = this.panel.querySelector('select')
        this.select.value = app.quality.tier
        this.select.addEventListener('change', () =>
        {
            app.quality.select(this.select.value)
            try { localStorage.setItem('portfolio-quality', this.select.value) } catch {}
        })
        this.panel.querySelector('button').addEventListener('click', () => this.startBenchmark())
        this.panel.querySelector('small').textContent = `${app.gpu} · ${navigator.userAgent}`
        this.onVisibilityChange = () =>
        {
            this.frames.length = 0
            app.quality.samples.length = 0
            if(document.hidden && this.benchmark) this.finishBenchmark(true)
        }
        document.addEventListener('visibilitychange', this.onVisibilityChange)
    }

    startBenchmark()
    {
        const w = this.app.world
        if(!w.started || this.benchmark || w.explorer.blocked) return
        w.explorer.enterCar(true)
        if(w.explorer.firstPerson) w.explorer.toggleView()
        const body = w.physics.car.chassis.body
        this.benchmark = { elapsed: 0, frames: [], maxDraws: 0, maxTriangles: 0,
            position: body.position.clone(), quaternion: body.quaternion.clone(),
            camera: this.app.camera.targetOverride, zoom: this.app.camera.zoom.targetValue,
            orbit: this.app.camera.orbitControls.enabled }
        w.experienceDirector.setInteractionLock('benchmark', true)
        this.app.camera.pan.reset()
        this.app.camera.zoom.targetValue = 0.2
        this.app.camera.orbitControls.enabled = false
        this.result = null
    }

    updateBenchmark(delta)
    {
        if(!this.benchmark && this.params.has('bench') && !this.autoRan && this.app.world?.started)
        {
            if(this.app.time.elapsed - this.app.world.startedAt < 5000) return
            this.autoRan = true
            this.startBenchmark()
        }
        const b = this.benchmark
        if(!b) return
        b.elapsed += delta / 1000
        const t = Math.min(b.elapsed / 60, 1)
        // A repeatable camera/car route; high sections are camera flyovers of
        // the existing world, not a claim that flight physics is implemented.
        const route = [[0, 0, 0.4], [0, -30, 0.4], [30, -29, 10], [145, -29, 22], [50, -35, 4], [1.2, -55, 0.4]]
        const section = Math.min(4, Math.floor(t * 5)), blend = t * 5 - section
        const a = route[section], c = route[section + 1]
        const position = this.app.camera.target.clone().set(...a).lerp(this.app.camera.target.clone().set(...c), blend)
        const w = this.app.world, body = w.physics.car.chassis.body
        body.position.copy(position)
        body.velocity.set(0, 0, 0)
        const yaw = Math.atan2(c[1] - a[1], c[0] - a[0])
        body.quaternion.setFromEuler(0, 0, yaw)
        w.experienceDirector.lockedCarPose.px = position.x
        w.experienceDirector.lockedCarPose.py = position.y
        w.experienceDirector.lockedCarPose.pz = position.z
        const pose = w.experienceDirector.lockedCarPose
        pose.qx = body.quaternion.x; pose.qy = body.quaternion.y
        pose.qz = body.quaternion.z; pose.qw = body.quaternion.w
        this.app.camera.targetOverride = position
        // Override the rendered pose as well as the target: project-zone GSAP
        // angle tweens must not change the scripted camera between runs.
        const camera = this.app.camera.instance
        camera.position.copy(position).add(this.app.camera.target.clone().set(9.1, -11.6, 9.2))
        camera.lookAt(position)
        camera.updateMatrixWorld()
        if(b.elapsed >= 60) this.finishBenchmark()
    }

    finishBenchmark(interrupted = false)
    {
        const b = this.benchmark
        if(!b) return
        const summary = summarizeFrames(b.frames)
        this.result = { ...summary, interrupted, seconds: b.elapsed, maxDraws: b.maxDraws,
            maxTriangles: b.maxTriangles, tier: this.app.quality.tier, dpr: this.app.quality.settings.dpr,
            gpu: this.app.gpu, viewport: [innerWidth, innerHeight], userAgent: navigator.userAgent,
            scene: this.app.config.neon ? 'crossroads look slice' : 'Manhattan baseline',
            meets35FpsAverage: !interrupted && !!summary && summary.averageFps >= 35 }
        console.info('Portfolio benchmark', JSON.stringify(this.result))
        const w = this.app.world
        const pose = w.experienceDirector.lockedCarPose
        pose.px = b.position.x; pose.py = b.position.y; pose.pz = b.position.z
        pose.qx = b.quaternion.x; pose.qy = b.quaternion.y; pose.qz = b.quaternion.z; pose.qw = b.quaternion.w
        const body = w.physics.car.chassis.body
        body.position.copy(b.position)
        body.quaternion.copy(b.quaternion)
        body.velocity.set(0, 0, 0)
        body.angularVelocity.set(0, 0, 0)
        w.experienceDirector.setInteractionLock('benchmark', false)
        this.app.camera.targetOverride = b.camera
        this.app.camera.zoom.targetValue = b.zoom
        this.app.camera.orbitControls.enabled = b.orbit
        this.benchmark = null
    }

    record(ms)
    {
        if(document.hidden || !this.app.world?.started) return
        this.frames.push(ms)
        if(this.frames.length > 180) this.frames.shift()
        const info = this.app.renderer.info
        if(this.benchmark)
        {
            this.benchmark.frames.push(ms)
            this.benchmark.maxDraws = Math.max(this.benchmark.maxDraws, info.render.calls)
            this.benchmark.maxTriangles = Math.max(this.benchmark.maxTriangles, info.render.triangles)
        }
        if(performance.now() - this.lastUpdate < 750) return
        this.lastUpdate = performance.now()
        const s = summarizeFrames(this.frames)
        this.stats = { ...s, calls: info.render.calls, triangles: info.render.triangles, textures: info.memory.textures,
            geometries: info.memory.geometries, tier: this.app.quality.tier, dpr: this.app.quality.settings.dpr }
        const q = this.app.quality
        this.select.value = q.tier
        this.output.textContent = `${s.averageFps.toFixed(1)} FPS · ${s.averageMs.toFixed(1)} ms · p95 ${s.p95Ms.toFixed(1)} ms\n${info.render.calls} draws · ${info.render.triangles.toLocaleString()} tris\n${info.memory.textures} textures · ${info.memory.geometries} geometries\n${q.tier.toUpperCase()} · DPR ${q.settings.dpr.toFixed(2)} · rung ${q.rung}${q.tier === 'low' ? ' · Low power' : ''}${this.benchmark ? `\nBenchmark ${this.benchmark.elapsed.toFixed(0)}/60s` : ''}${this.result ? `\nLast run: ${this.result.averageFps?.toFixed(1)} FPS · 1% low ${this.result.onePercentLow?.toFixed(1)}` : ''}`
    }

    dispose()
    {
        document.removeEventListener('visibilitychange', this.onVisibilityChange)
        this.panel.remove()
    }
}
