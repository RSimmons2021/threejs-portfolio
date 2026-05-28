import CANNON from 'cannon'

export default class GuidedTour
{
    constructor(_options)
    {
        this.camera = _options.camera
        this.physics = _options.physics
        this.controls = _options.controls
        this.ghostCar = _options.ghostCar

        this.targets = [
            { id: 'intro', label: 'Intro', x: 0, y: 2, z: 3, heading: - Math.PI * 0.5, cameraAngle: 'default', zoom: 0.42 },
            { id: 'projects', label: 'Projects', x: 42, y: - 30, z: 3, heading: 0, cameraAngle: 'projects', zoom: 0.3 },
            { id: 'about', label: 'About', x: 1.2, y: - 54, z: 3, heading: - Math.PI * 0.5, cameraAngle: 'default', zoom: 0.42 },
            { id: 'play', label: 'Play', x: - 38, y: - 34, z: 3, heading: 0, cameraAngle: 'default', zoom: 0.5 }
        ]

        this.setElement()
    }

    setElement()
    {
        this.$element = document.createElement('nav')
        this.$element.className = 'guided-tour'
        this.$element.setAttribute('aria-label', 'Portfolio tour')
        this.$element.innerHTML = this.targets.map((_target) => `
            <button class="guided-tour__button" type="button" data-tour-target="${_target.id}">
                ${_target.label}
            </button>
        `).join('')

        this.$element.addEventListener('click', (_event) =>
        {
            const button = _event.target.closest('[data-tour-target]')
            if(!button)
            {
                return
            }

            const target = this.targets.find((_item) => _item.id === button.dataset.tourTarget)
            if(target)
            {
                this.goTo(target)
            }
        })

        document.body.appendChild(this.$element)
    }

    goTo(_target)
    {
        const body = this.physics?.car?.chassis?.body
        if(!body)
        {
            return
        }

        this.clearControls()

        if(this.ghostCar)
        {
            this.ghostCar.settings.autoTour = false
        }

        body.position.set(_target.x, _target.y, _target.z)
        body.velocity.set(0, 0, 0)
        body.angularVelocity.set(0, 0, 0)
        body.force.set(0, 0, 0)
        body.torque.set(0, 0, 0)
        body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), _target.heading)
        body.wakeUp()

        if(this.physics.car.oldPosition)
        {
            this.physics.car.oldPosition.copy(body.position)
        }

        this.camera.pan.reset()
        this.camera.angle.set(_target.cameraAngle)
        this.camera.zoom.targetValue = _target.zoom

        this.setActive(_target.id)
    }

    clearControls()
    {
        if(!this.controls?.actions)
        {
            return
        }

        for(const action in this.controls.actions)
        {
            this.controls.actions[action] = false
        }
    }

    setActive(_id)
    {
        const buttons = this.$element.querySelectorAll('[data-tour-target]')
        for(const button of buttons)
        {
            button.classList.toggle('is-active', button.dataset.tourTarget === _id)
        }
    }
}
