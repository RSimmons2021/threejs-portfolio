import test from 'node:test'
import assert from 'node:assert/strict'
import { isInterfaceKey } from '../src/javascript/World/interfaceInput.js'

const event = (code, context = '') => ({ code, target: { closest: selector => context && selector.includes(context) } })
test('native UI activation and selection keys never drive or enter the city', () =>
{
    for(const context of ['button', 'a', 'summary', 'select', 'input'])
        for(const code of ['Enter', 'Space', 'ArrowUp', 'ArrowDown']) assert.ok(isInterfaceKey(event(code, context)))
})
test('world letter shortcuts work after clicking controls but not in text fields or dialogs', () =>
{
    assert.equal(isInterfaceKey(event('KeyW', 'button')), false)
    for(const context of ['input', 'textarea', 'select', 'dialog[open]', '[contenteditable="true"]'])
        assert.ok(isInterfaceKey(event('KeyR', context)))
    assert.ok(isInterfaceKey({ code: 'KeyW', defaultPrevented: true }))
    assert.equal(isInterfaceKey(event('KeyW')), false)
})
