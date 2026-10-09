// Native controls must own their navigation/activation keys. Letter shortcuts
// still work after clicking a movement button, but never inside a form/dialog.
export function isInterfaceKey(event)
{
    if(event.defaultPrevented) return true
    if(event.target?.closest?.('input, select, textarea, [contenteditable="true"], dialog[open]')) return true
    return ['Enter', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.code)
        && !!event.target?.closest?.('button, a, summary')
}
