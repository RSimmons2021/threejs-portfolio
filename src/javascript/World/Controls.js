import { bindTravelAction, setTravelButton } from './travelControls.js'
import EventEmitter from '../Utils/EventEmitter'
import * as THREE from 'three'
import { joystickWorldYaw } from './movementRules.js'
import { isInterfaceKey } from './interfaceInput.js'

export default class Controls extends EventEmitter
{
    constructor(_options)
    {
        super()

        this.config = _options.config
        this.sizes = _options.sizes
        this.time = _options.time
        this.camera = _options.camera
        this.sounds = _options.sounds
        this.viewDirection = new THREE.Vector3()
        this.lastViewYaw = Math.atan2(-this.camera.angle.value.y, -this.camera.angle.value.x)

        this.setActions()
        this.setKeyboard()
    }

    getViewYaw()
    {
        this.camera.instance.getWorldDirection(this.viewDirection)
        if(Math.hypot(this.viewDirection.x, this.viewDirection.y) > 0.001)
            this.lastViewYaw = Math.atan2(this.viewDirection.y, this.viewDirection.x)
        return this.lastViewYaw
    }

    setTravelMode(onFoot, skating = false, flight = this.flight)
    {
        const state = `${onFoot}|${skating}|${flight?.mode || 'grounded'}`
        this.flight = flight
        this.travelMode = { onFoot, skating }
        if(!this.touch?.boost || state === this.touchTravelState) return
        this.touchTravelState = state
        this.releaseTouchPedals()
        const airborne = !onFoot && !!flight?.airborne
        const transitioning = airborne && flight.mode !== 'flying'
        const labels = {
            boost: onFoot ? [skating ? 'walk' : 'skate', skating ? 'Walk' : 'Skate', skating ? 'Step off skateboard and walk' : 'Get on skateboard'] : ['boost', 'Boost', 'Hold to boost'],
            forward: airborne ? ['up', 'Up', 'Hold to climb'] : ['forward', 'Drive', 'Hold to accelerate'],
            backward: airborne ? ['down', 'Down', 'Hold to descend'] : ['reverse', 'Reverse', 'Hold to reverse'],
            brake: ['brake', 'Brake', 'Hold to brake']
        }
        for(const name of ['boost', 'forward', 'backward', 'brake'])
        {
            const button = this.touch[name].$element
            const [icon, label, accessibleLabel] = labels[name]
            setTravelButton(button, icon, label, '')
            button.setAttribute('aria-label', accessibleLabel)
            button.hidden = name !== 'boost' && (onFoot || (airborne && name === 'brake'))
            button.disabled = transitioning && ['forward', 'backward'].includes(name)
        }
        this.touch.boost.$element.setAttribute('aria-pressed', String(onFoot && skating))
    }

    releaseTouchPedals()
    {
        if(!this.touchHeld) return
        for(const control of Object.values(this.touch)) control.release?.()
    }

    updateTouchPedalInput()
    {
        const held = name => this.touchHeld.has(name)
        const airborne = !!this.flight?.airborne
        const onFoot = this.travelMode.onFoot
        this.actions.up = !onFoot && (held('boost') || (!airborne && held('forward')))
        this.actions.down = !onFoot && !airborne && held('backward')
        this.actions.brake = !onFoot && !airborne && held('brake')
        this.actions.boost = !onFoot && held('boost')
        if(this.flight)
        {
            this.flight.touchClimb = airborne && held('forward')
            this.flight.touchDescend = airborne && held('backward')
        }
    }

    cancelTouchInput()
    {
        this.releaseTouchPedals()
        const joystick = this.touch?.joystick
        if(!joystick?.active) return
        joystick.events.touchend({ changedTouches: [{ identifier: joystick.touchIdentifier }] })
    }

    createTouchPedal(name)
    {
        const control = { $element: document.createElement('button') }
        const button = control.$element
        button.type = 'button'
        button.className = 'world-touch-control touch-pedal'
        button.dataset.worldControl = name
        button.style.opacity = '0'
        document.body.appendChild(button)
        this.touch[name] = control
        let pointer = null, keyHeld = false
        const release = () =>
        {
            const captured = pointer
            pointer = null
            keyHeld = false
            const wasHeld = this.touchHeld.delete(name)
            button.classList.remove('is-held')
            if(wasHeld) this.updateTouchPedalInput()
            if(captured !== null && button.hasPointerCapture(captured)) button.releasePointerCapture(captured)
        }
        control.release = release
        const press = () =>
        {
            if(button.disabled || this.isTravelBlocked?.()) return
            this.touchHeld.add(name)
            button.classList.add('is-held')
            this.camera.pan.reset()
            this.updateTouchPedalInput()
        }
        button.addEventListener('pointerdown', event =>
        {
            // The same pedal is a discrete skateboard toggle while on foot.
            if(name === 'boost' && this.travelMode.onFoot) return
            event.preventDefault()
            if(pointer !== null) return
            pointer = event.pointerId
            button.setPointerCapture(pointer)
            press()
        })
        for(const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
            button.addEventListener(type, event => { if(event.pointerId === pointer) release() })
        button.addEventListener('keydown', event =>
        {
            if(!['Space', 'Enter'].includes(event.code) || (name === 'boost' && this.travelMode.onFoot)) return
            event.preventDefault()
            if(event.repeat || keyHeld) return
            keyHeld = true
            press()
        })
        button.addEventListener('keyup', event =>
        {
            if(!['Space', 'Enter'].includes(event.code) || !keyHeld) return
            event.preventDefault()
            release()
        })
        button.addEventListener('blur', release)
        if(name === 'boost') bindTravelAction(button, () =>
        {
            if(this.travelMode.onFoot) this.onFootBoost?.()
        })
    }

    setActions()
    {
        this.actions = {}
        this.actions.up = false
        this.actions.right = false
        this.actions.down = false
        this.actions.left = false
        this.actions.brake = false
        this.actions.boost = false

        document.addEventListener('visibilitychange', () =>
        {
            if(!document.hidden)
            {
                this.actions.up = false
                this.actions.right = false
                this.actions.down = false
                this.actions.left = false
                this.actions.brake = false
                this.actions.boost = false
            }
        })
    }

    setKeyboard()
    {
        this.keyboard = {}
        this.keyboard.events = {}

        this.keyboard.events.keyDown = (_event) =>
        {
            if(isInterfaceKey(_event)) return
            switch(_event.code)
            {
                case 'ArrowUp':
                case 'KeyW':
                    this.camera.pan.reset()
                    this.actions.up = true
                    break

                case 'ArrowRight':
                case 'KeyD':
                    this.actions.right = true
                    break

                case 'ArrowDown':
                case 'KeyS':
                    this.camera.pan.reset()
                    this.actions.down = true
                    break

                case 'ArrowLeft':
                case 'KeyA':
                    this.actions.left = true
                    break

                case 'ControlLeft':
                case 'ControlRight':
                case 'Space':
                    this.actions.brake = true
                    break

                case 'ShiftLeft':
                case 'ShiftRight':
                    this.actions.boost = true
                    break

                // case ' ':
                //     this.jump(true)
                //     break
            }
        }

        this.keyboard.events.keyUp = (_event) =>
        {
            switch(_event.code)
            {
                case 'ArrowUp':
                case 'KeyW':
                    this.actions.up = false
                    break

                case 'ArrowRight':
                case 'KeyD':
                    this.actions.right = false
                    break

                case 'ArrowDown':
                case 'KeyS':
                    this.actions.down = false
                    break

                case 'ArrowLeft':
                case 'KeyA':
                    this.actions.left = false
                    break

                case 'ControlLeft':
                case 'ControlRight':
                case 'Space':
                    this.actions.brake = false
                    break

                case 'ShiftLeft':
                case 'ShiftRight':
                    this.actions.boost = false
                    break

                case 'KeyR':
                    if(isInterfaceKey(_event)) break
                    this.trigger('action', ['reset'])
                    break
            }
        }

        document.addEventListener('keydown', this.keyboard.events.keyDown)
        document.addEventListener('keyup', this.keyboard.events.keyUp)
    }

    setTouch()
    {
        if(this.touch) return
        this.touch = {}
        this.touchHeld = new Set()

        /**
         * Joystick
         */
        this.touch.joystick = {}
        this.touch.joystick.active = false

        // Element
        this.touch.joystick.$element = document.createElement('div')
        this.touch.joystick.$element.style.userSelect = 'none'
        this.touch.joystick.$element.style.position = 'fixed'
        this.touch.joystick.$element.style.bottom = '10px'
        this.touch.joystick.$element.style.left = '10px'
        this.touch.joystick.$element.style.width = '170px'
        this.touch.joystick.$element.style.height = '170px'
        this.touch.joystick.$element.style.borderRadius = '50%'
        this.touch.joystick.$element.style.transition = 'opacity 0.3s 0.0s'
        this.touch.joystick.$element.style.willChange = 'opacity'
        this.touch.joystick.$element.style.opacity = '0'
        document.body.appendChild(this.touch.joystick.$element)

        this.touch.joystick.$cursor = document.createElement('div')
        this.touch.joystick.$cursor.style.position = 'absolute'
        this.touch.joystick.$cursor.style.top = 'calc(50% - 30px)'
        this.touch.joystick.$cursor.style.left = 'calc(50% - 30px)'
        this.touch.joystick.$cursor.style.width = '60px'
        this.touch.joystick.$cursor.style.height = '60px'
        this.touch.joystick.$cursor.style.border = '2px solid rgba(142, 212, 255, 0.85)'
        this.touch.joystick.$cursor.style.borderRadius = '50%'
        this.touch.joystick.$cursor.style.background = 'radial-gradient(circle, rgba(142, 212, 255, 0.15), transparent 70%)'
        this.touch.joystick.$cursor.style.boxShadow = '0 0 12px rgba(142, 212, 255, 0.25), inset 0 0 8px rgba(142, 212, 255, 0.1)'
        this.touch.joystick.$cursor.style.boxSizing = 'border-box'
        this.touch.joystick.$cursor.style.pointerEvents = 'none'
        this.touch.joystick.$cursor.style.willChange = 'transform'
        this.touch.joystick.$cursor.style.transition = 'box-shadow 0.2s ease'
        this.touch.joystick.$element.appendChild(this.touch.joystick.$cursor)

        this.touch.joystick.$limit = document.createElement('div')
        this.touch.joystick.$limit.style.position = 'absolute'
        this.touch.joystick.$limit.style.top = 'calc(50% - 75px)'
        this.touch.joystick.$limit.style.left = 'calc(50% - 75px)'
        this.touch.joystick.$limit.style.width = '150px'
        this.touch.joystick.$limit.style.height = '150px'
        this.touch.joystick.$limit.style.border = '1px solid rgba(173, 222, 255, 0.35)'
        this.touch.joystick.$limit.style.borderRadius = '50%'
        this.touch.joystick.$limit.style.background = 'radial-gradient(circle, rgba(11, 20, 30, 0.4), rgba(11, 20, 30, 0.2) 70%)'
        this.touch.joystick.$limit.style.backdropFilter = 'blur(4px)'
        this.touch.joystick.$limit.style.boxShadow = 'inset 0 0 0 1px rgba(255, 255, 255, 0.06), 0 8px 24px rgba(3, 10, 16, 0.3)'
        this.touch.joystick.$limit.style.opacity = '0.6'
        this.touch.joystick.$limit.style.pointerEvents = 'none'
        this.touch.joystick.$limit.style.boxSizing = 'border-box'
        this.touch.joystick.$limit.style.transition = 'opacity 0.2s ease, border-color 0.2s ease'
        this.touch.joystick.$element.appendChild(this.touch.joystick.$limit)

        // Angle
        this.touch.joystick.angle = {}

        this.touch.joystick.angle.center = {}
        this.touch.joystick.angle.center.x = 0
        this.touch.joystick.angle.center.y = 0

        this.touch.joystick.angle.current = {}
        this.touch.joystick.angle.current.x = 0
        this.touch.joystick.angle.current.y = 0

        this.touch.joystick.angle.originalValue = 0
        this.touch.joystick.angle.value = - Math.PI * 0.5

        // Resize
        this.touch.joystick.resize = () =>
        {
            const boundings = this.touch.joystick.$element.getBoundingClientRect()

            this.touch.joystick.angle.center.x = boundings.left + boundings.width * 0.5
            this.touch.joystick.angle.center.y = boundings.top + boundings.height * 0.5
            this.touch.joystick.maxRadius = Math.max(0, Math.min(43, boundings.width * 0.5 - 30))
        }

        this.sizes.on('resize', this.touch.joystick.resize)
        this.touch.joystick.resize()

        // Time tick
        this.time.on('tick', () =>
        {
            // Joystick active
            if(this.touch.joystick.active)
            {
                // Calculate joystick angle
                this.touch.joystick.angle.originalValue = - Math.atan2(
                    this.touch.joystick.angle.current.y - this.touch.joystick.angle.center.y,
                    this.touch.joystick.angle.current.x - this.touch.joystick.angle.center.x
                )
                this.touch.joystick.angle.value = joystickWorldYaw(this.touch.joystick.angle.originalValue, this.getViewYaw())

                // Update joystick
                const distance = Math.hypot(this.touch.joystick.angle.current.y - this.touch.joystick.angle.center.y, this.touch.joystick.angle.current.x - this.touch.joystick.angle.center.x)
                let radius = distance
                if(radius > 20)
                {
                    radius = 20 + Math.log(distance - 20) * 5
                }
                if(radius > this.touch.joystick.maxRadius)
                {
                    radius = this.touch.joystick.maxRadius
                }
                const cursorX = Math.sin(this.touch.joystick.angle.originalValue + Math.PI * 0.5) * radius
                const cursorY = Math.cos(this.touch.joystick.angle.originalValue + Math.PI * 0.5) * radius
                this.touch.joystick.$cursor.style.transform = `translateX(${cursorX}px) translateY(${cursorY}px)`
            }
        })

        // Events
        this.touch.joystick.events = {}
        this.touch.joystick.touchIdentifier = null
        this.touch.joystick.events.touchstart = (_event) =>
        {
            _event.preventDefault()

            const touch = _event.changedTouches[0]

            if(touch)
            {
                // The first touch can build this control while the welcome
                // screen still hides it. Measure its visible position per gesture.
                this.touch.joystick.resize()
                this.touch.joystick.active = true

                this.touch.joystick.touchIdentifier = touch.identifier

                this.touch.joystick.angle.current.x = touch.clientX
                this.touch.joystick.angle.current.y = touch.clientY

                this.touch.joystick.$limit.style.opacity = '0.85'
                this.touch.joystick.$limit.style.borderColor = 'rgba(142, 212, 255, 0.6)'
                this.touch.joystick.$cursor.style.boxShadow = '0 0 18px rgba(142, 212, 255, 0.4), inset 0 0 10px rgba(142, 212, 255, 0.15)'

                document.addEventListener('touchend', this.touch.joystick.events.touchend)
                document.addEventListener('touchcancel', this.touch.joystick.events.touchend)
                document.addEventListener('touchmove', this.touch.joystick.events.touchmove, { passive: false })

                this.trigger('joystickStart')
            }
        }

        this.touch.joystick.events.touchmove = (_event) =>
        {
            _event.preventDefault()

            const touches = [..._event.changedTouches]
            const touch = touches.find((_touch) => _touch.identifier === this.touch.joystick.touchIdentifier)

            if(touch)
            {
                this.touch.joystick.angle.current.x = touch.clientX
                this.touch.joystick.angle.current.y = touch.clientY

                this.trigger('joystickMove')
            }
        }

        this.touch.joystick.events.touchend = (_event) =>
        {
            const touches = [..._event.changedTouches]
            const touch = touches.find((_touch) => _touch.identifier === this.touch.joystick.touchIdentifier)

            if(touch)
            {
                this.touch.joystick.active = false

                this.touch.joystick.$limit.style.opacity = '0.6'
                this.touch.joystick.$limit.style.borderColor = 'rgba(173, 222, 255, 0.35)'
                this.touch.joystick.$cursor.style.boxShadow = '0 0 12px rgba(142, 212, 255, 0.25), inset 0 0 8px rgba(142, 212, 255, 0.1)'

                this.touch.joystick.$cursor.style.transform = 'translateX(0px) translateY(0px)'

                document.removeEventListener('touchend', this.touch.joystick.events.touchend)
                document.removeEventListener('touchcancel', this.touch.joystick.events.touchend)
                document.removeEventListener('touchmove', this.touch.joystick.events.touchmove)

                this.trigger('joystickEnd')
            }
        }

        this.touch.joystick.$element.addEventListener('touchstart', this.touch.joystick.events.touchstart, { passive: false })

        for(const name of ['boost', 'forward', 'brake', 'backward']) this.createTouchPedal(name)
        this.touch.reveal = () =>
        {
            for(const control of Object.values(this.touch))
                if(control.$element) control.$element.style.opacity = '1'
            this.touch.joystick.resize()
        }
        window.addEventListener('blur', () => this.cancelTouchInput())
        document.addEventListener('visibilitychange', () => { if(document.hidden) this.cancelTouchInput() })
        for(const [name, control] of Object.entries(this.touch))
        {
            if(!control.$element) continue
            control.$element.classList.add('world-touch-control')
            control.$element.dataset.worldControl = name
        }
        this.touchTravelState = ''
        this.setTravelMode(this.travelMode?.onFoot || false, this.travelMode?.skating || false)
        this.touch.joystick.resize()
    }
}
