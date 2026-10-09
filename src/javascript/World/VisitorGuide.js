import * as THREE from 'three'
import { cityGuideRoute, guideBearing, cityGuideMarkers, smoothGuideRotation, guideWaypoint, guideNeedsReroute } from './cityGuideRules.js'

export default class VisitorGuide
{
    constructor(world)
    {
        this.world = world
        this.container = new THREE.Group()
        this.container.name = 'Selected destination / street guide'
        this.lastUpdate = -Infinity
        this.bearingRotation = null
        this.destination = null
        this.arrivalShown = false
        // A dedicated information column opens the real experience summary,
        // not a career shift or locked employer door.
        this.experienceArea = world.areas.add({
            position: new THREE.Vector2(0, -54), halfExtents: new THREE.Vector2(2, 2),
            entryLabel: 'Experience & technical stack', entryColor: '#68e9f5'
        })
        this.experienceArea.on('interact', () => this.readExperience())
        this.buildInterface()
        this.buildMarkers()
        world.time.on('tick', () => this.update())
        window.addEventListener('portfolio:guide', () => this.open())
        window.addEventListener('portfolio:navigate', () => this.clear())
    }

    buildInterface()
    {
        this.$dialog = document.createElement('dialog')
        this.$dialog.className = 'visitor-guide'
        this.$dialog.setAttribute('aria-labelledby', 'visitor-guide-title')
        this.$dialog.innerHTML = `
            <header><p class="visitor-guide__eyebrow">WELCOME TO THE NEON DISTRICT</p><h1 id="visitor-guide-title">What would you like to see?</h1><p>This is a portfolio first. Choose the information you need; the city will point the way. You can also read it immediately.</p><button type="button" data-guide-close aria-label="Close destination chooser">Close</button></header>
            <section aria-labelledby="visitor-guide-information"><h2 id="visitor-guide-information">Portfolio information</h2><div class="visitor-guide__choices">
                <button type="button" data-destination="projects"><strong>01 / Projects</strong><span>Six builds · case studies · live links</span></button>
                <button type="button" data-destination="experience"><strong>02 / Experience</strong><span>Roles · responsibilities · technical stack</span></button>
                <button type="button" data-destination="contact"><strong>03 / Contact</strong><span>Email · GitHub · LinkedIn</span></button>
                <a class="js-resume" href="${document.querySelector('.js-resume')?.href || '#'}" download="Richard_Simmons_Resume_AI.pdf" aria-label="Download Richard Simmons’s résumé as a PDF"><strong>04 / Résumé ↓</strong><span>Download the PDF · no exploration needed</span></a>
            </div><label class="visitor-guide__project-choice">Which project?<select aria-label="Project to guide me to">${this.world.experienceDirector.projects.map((project, index) => `<option value="${index}">0${index + 1} / ${project.name}</option>`).join('')}</select></label><div class="visitor-guide__direct"><button type="button" data-guide-overview>Read everything now</button><button type="button" data-guide-close>Explore freely</button></div></section>
            <section class="visitor-guide__play" aria-labelledby="visitor-guide-play"><div><h2 id="visitor-guide-play">Optional / Play</h2><p>The Arcade is for games, not required information.</p></div><button type="button" data-destination="play">Show me the Arcade →</button></section>`
        document.body.appendChild(this.$dialog)
        this.$dialog.addEventListener('click', event =>
        {
            const destination = event.target.closest('[data-destination]')?.dataset.destination
            if(destination) { this.close(); this.choose(destination, Number(this.$dialog.querySelector('select').value)) }
            if(event.target.closest('[data-guide-close], a[download]')) this.close()
            if(event.target.closest('[data-guide-overview]')) { this.close(); window.dispatchEvent(new Event('portfolio:brief')) }
        })
        this.$dialog.addEventListener('cancel', event => { event.preventDefault(); this.close() })
        this.$route = document.createElement('section')
        this.$route.className = 'destination-guide'
        this.$route.hidden = true
        this.$route.setAttribute('aria-label', 'Directions to selected destination')
        this.$route.innerHTML = '<div class="destination-guide__heading"><span data-bearing aria-hidden="true">↑</span><div><small data-category>PORTFOLIO INFORMATION</small><h2 data-name></h2></div><button type="button" data-route-clear aria-label="Clear destination">×</button></div><p data-direction></p><div class="destination-guide__actions"><button type="button" data-route-read>Read now</button><button type="button" data-route-jump>Jump there</button><button type="button" data-route-change>Change</button></div><p class="destination-guide__hint" data-hint></p>'
        document.body.appendChild(this.$route)
        this.$route.querySelector('[data-route-clear]').onclick = () => this.clear()
        this.$route.querySelector('[data-route-change]').onclick = () => this.open()
        this.$route.querySelector('[data-route-jump]').onclick = () => this.jump()
        this.$route.querySelector('[data-route-read]').onclick = () => this.read()
        this.$name = this.$route.querySelector('[data-name]')
        this.$category = this.$route.querySelector('[data-category]')
        this.$read = this.$route.querySelector('[data-route-read]')
        this.$hint = this.$route.querySelector('[data-hint]')
        this.$bearing = this.$route.querySelector('[data-bearing]')
        this.$direction = this.$route.querySelector('[data-direction]')
    }

    buildMarkers()
    {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.Float32BufferAttribute([
            -.6,-.48,0, .05,0,0, -.6,.48,0, -.4,.48,0, .28,0,0, -.4,-.48,0
        ], 3))
        geometry.setIndex([0,1,5, 5,1,4, 1,2,3, 1,3,4])
        this.markerMaterial = new THREE.MeshBasicMaterial({ color: '#68e9f5', side: THREE.DoubleSide, toneMapped: false })
        this.markers = new THREE.InstancedMesh(geometry, this.markerMaterial, 28)
        this.markers.count = 0
        this.markers.frustumCulled = false
        this.container.add(this.markers)
        this.transform = new THREE.Object3D()
        this.markerPoints = []
        this.flightPath = [[0, 0], [0, 0]]
    }

    open()
    {
        if(this.$dialog.open || this.world.miniGames.active || this.world.arcade.state !== 'idle' || document.querySelector('dialog[open]')) return
        this.returnFocus = document.activeElement
        this.arrivalShown = true
        if(document.pointerLockElement) document.exitPointerLock()
        this.world.experienceDirector.setInteractionLock('guide', true)
        document.body.classList.add('has-visitor-guide')
        this.$dialog.showModal()
        this.$dialog.querySelector('[data-destination="projects"]').focus({ preventScroll: true })
    }

    close()
    {
        if(this.$dialog.open) this.$dialog.close()
        document.body.classList.remove('has-visitor-guide')
        this.world.experienceDirector.setInteractionLock('guide', false)
        if(this.returnFocus?.isConnected) this.returnFocus.focus({ preventScroll: true })
    }

    choose(id, index = 0)
    {
        const w = this.world
        if(id === 'projects')
        {
            const project = w.experienceDirector.projects[index]
            this.destination = { id, group: 'projects', name: project.name, x: project.floor.area.position.x, y: project.floor.area.position.y, area: project.floor.area, project, index }
        }
        else if(id === 'experience') this.destination = { id, group: 'about', name: 'Experience & technical stack', x: 0, y: -54, area: this.experienceArea }
        else if(id === 'contact') this.destination = { id, group: 'about', name: 'Contact · Email, GitHub & LinkedIn', x: 16, y: -56.5 }
        else this.destination = { id: 'play', group: 'play', name: 'After Hours Arcade', x: -22, y: -43 }
        w.guidedTour.setActive(this.destination.group)
        this.$name.textContent = this.destination.name
        this.$category.textContent = id === 'play' ? 'OPTIONAL / GAMES' : 'PORTFOLIO / INFORMATION'
        this.$read.textContent = id === 'play' ? 'Games menu' : id === 'projects' ? 'Read case study' : 'Read now'
        this.$hint.textContent = id === 'play' ? 'Games are optional. Nothing in the portfolio requires a score.' : 'Follow the cyan street arrows—or use Read now / Jump there.'
        this.$route.dataset.category = id === 'play' ? 'play' : 'information'
        document.body.dataset.guideCategory = this.$route.dataset.category
        document.body.classList.add('has-destination-guide')
        this.markerMaterial.color.set(id === 'play' ? '#e8a6ff' : '#68e9f5')
        this.rebuildRoute()
        this.lastUpdate = -Infinity
        this.bearingRotation = null
        this.$route.hidden = false
    }

    guideTour(target)
    {
        if(target.id === 'projects') this.choose('projects', Math.max(0, Math.min(5, Math.round((target.x - 30) / 24))))
        else if(target.id === 'play') this.choose('play')
        else if(target.id === 'about') this.choose('contact')
    }

    rebuildRoute()
    {
        this.path = cityGuideRoute(this.world.explorer.renderPosition, this.destination)
        this.waypoint = Math.min(1, this.path.length - 1)
        this.drawMarkers()
    }

    drawMarkers()
    {
        const p = this.world.explorer.renderPosition
        const flying = p.z > 3
        this.flightPath[1][0] = this.destination.x
        this.flightPath[1][1] = this.destination.y
        const points = cityGuideMarkers(flying ? this.flightPath : this.path, flying ? 1 : this.waypoint, p, 28, this.markerPoints)
        const height = flying ? p.z - .75 : .09
        for(const [index, point] of points.entries())
        {
            this.transform.position.set(point.x, point.y, height)
            this.transform.rotation.z = point.yaw
            this.transform.updateMatrix()
            this.markers.setMatrixAt(index, this.transform.matrix)
        }
        this.markers.count = points.length
        this.markers.instanceMatrix.needsUpdate = true
    }

    read()
    {
        const destination = this.destination
        if(!destination) return
        if(destination.id === 'projects') this.world.experienceDirector.openPortal(destination.project)
        else if(destination.id === 'play') this.jump()
        else
        {
            if(destination.id === 'experience') this.readExperience()
            else
            {
                window.dispatchEvent(new Event('portfolio:brief'))
                document.querySelector('.brief__head')?.scrollIntoView({ block: 'start' })
            }
        }
    }

    readExperience()
    {
        window.dispatchEvent(new Event('portfolio:brief'))
        document.querySelector('#brief-experience')?.scrollIntoView({ block: 'start' })
    }

    jump()
    {
        const destination = this.destination
        if(!destination) return
        const target = destination.group === 'projects'
            ? { id: 'projects', x: destination.project.x, y: -30, z: 1, heading: 0, cameraAngle: 'projects', zoom: .3 }
            : destination.group === 'play' ? this.world.guidedTour.targets.find(target => target.id === 'play')
            : { id: 'about', x: destination.x, y: destination.y, z: 1, heading: 0, cameraAngle: 'default', zoom: .42 }
        this.world.guidedTour.goTo(target)
        this.choose(destination.id, destination.index)
    }

    clear()
    {
        this.destination = null
        this.$route.hidden = true
        this.markers.count = 0
        document.body.classList.remove('has-destination-guide')
        delete document.body.dataset.guideCategory
    }

    // Called in the existing render phase, after the follow/first-person camera.
    // The tiny compass transform and one instanced trail follow the rendered
    // player every frame; text labels stay at 4 Hz. No extra animation loop.
    updateBearing()
    {
        if(!this.destination || this.$route.hidden) return
        const p = this.world.explorer.renderPosition
        if(p.z <= 3)
        {
            this.waypoint = guideWaypoint(this.path, this.waypoint, p)
            if(guideNeedsReroute(this.path, this.waypoint, p)) this.rebuildRoute()
        }
        const target = p.z > 3 ? [this.destination.x, this.destination.y] : this.path[this.waypoint]
        const bearing = guideBearing(p, target, this.world.controls.getViewYaw())
        this.bearingRotation = smoothGuideRotation(this.bearingRotation, bearing.rotation, this.world.time.delta / 1000, this.world.config.reducedMotion)
        this.$bearing.style.transform = `rotate(${this.bearingRotation}deg)`
        this.markers.visible = Math.hypot(this.destination.x - p.x, this.destination.y - p.y) >= 3
        if(this.markers.visible) this.drawMarkers()
    }

    update()
    {
        const w = this.world, p = w.explorer.position
        if(!this.arrivalShown && w.time.elapsed - w.startedAt > 3500 && p.z < 1 && !document.querySelector('dialog[open]') && !w.miniGames.active && w.arcade.state === 'idle')
        {
            this.arrivalShown = true
            // Explicit opt-out for repeat visits and automated performance routes.
            if(new URLSearchParams(window.location.search).get('guide') !== '0') this.open()
        }
        if(w.time.elapsed - this.lastUpdate < 250) return
        this.lastUpdate = w.time.elapsed
        const hidden = !this.destination || !!document.querySelector('dialog[open]') || !!w.miniGames.active || w.arcade.state !== 'idle' || !!w.interiors.active
        this.$route.hidden = hidden
        this.markers.visible = !hidden
        if(hidden) return
        const destination = this.destination
        const distance = Math.hypot(destination.x - p.x, destination.y - p.y)
        if(distance < 3) this.markers.visible = false
        const target = p.z > 3 ? [destination.x, destination.y] : this.path[this.waypoint]
        const bearing = guideBearing(p, target, w.controls.getViewYaw())
        this.$direction.textContent = distance < 3 ? 'You’re here · use the light column or the button below.' : `${bearing.direction} · ${Math.ceil(distance)} m to destination${p.z > 3 ? ' · fly to the light column' : ' · follow the street arrows'}`
    }
}
