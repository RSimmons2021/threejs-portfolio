// Run immediately after ENTER SITE on touch, before resizing the window.
// The joystick was built while hidden and used to keep its center at (0, 0).
(async () =>
{
    const app = application, controls = app.world.controls, results = []
    const joystick = controls.touch.joystick
    const running = app.time.running
    app.time.stop()
    try
    {
        const rect = joystick.$element.getBoundingClientRect()
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
        for(const [name, dx, dy] of [['up', 0, -40], ['right', 40, 0], ['down', 0, 40], ['left', -40, 0]])
        {
            const touch = new Touch({ identifier: 91, target: joystick.$element, clientX: x + dx, clientY: y + dy })
            joystick.$element.dispatchEvent(new TouchEvent('touchstart', { changedTouches: [touch], touches: [touch], bubbles: true, cancelable: true }))
            app.time.trigger('tick')
            const cursor = new DOMMatrix(getComputedStyle(joystick.$cursor).transform)
            if(cursor.m41 * dx + cursor.m42 * dy <= 0 || Math.abs(dx ? cursor.m42 : cursor.m41) > 1)
                throw new Error(`${name}: joystick does not follow the visible gesture`)
            document.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch], touches: [], bubbles: true }))
            if(joystick.active) throw new Error(`${name}: joystick stays active after release`)
            results.push(`${name}: correct direction and release`)
        }
        return { passed: results.length, results }
    }
    finally
    {
        controls.cancelTouchInput()
        if(running) app.time.resume()
    }
})()
