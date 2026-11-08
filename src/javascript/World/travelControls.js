const icons = {
    takeoff: '<path d="M12 17V3m-5 5 5-5 5 5M5 15v5h14v-5"/>',
    land: '<path d="M12 3v14m-5-5 5 5 5-5M5 18v3h14v-3"/>',
    car: '<path d="m5 9 2-5h10l2 5M4 9h16v9H4zM7 18v2m10-2v2M7 13h2m6 0h2"/>',
    exit: '<path d="M10 4H4v16h6m4-13 5 5-5 5m-7-5h12"/>',
    firstPerson: '<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/><circle cx="12" cy="12" r="3"/>',
    cityView: '<path d="m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>',
    skate: '<path d="M3 13c1 3 3 4 6 4h6c3 0 5-1 6-4M7 20h.01M17 20h.01"/>',
    walk: '<circle cx="14" cy="4" r="2"/><path d="m7 11 4-3 4 2 4 1m-8-3-1 7-4 6m4-6 5 2 1 4"/>'
}

export function setTravelButton(button, icon, label, shortcut)
{
    const state = `${icon}|${label}`
    if(button.dataset.travelState === state) return
    button.dataset.travelState = state
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[icon]}</svg><span class="explorer-controls__label">${label}</span><kbd aria-hidden="true">${shortcut}</kbd>`
}
