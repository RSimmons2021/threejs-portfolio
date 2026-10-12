// agent-browser --json eval --stdin < scripts/brand-icon.browser.js > /tmp/rs-icon-export.json
// python3 scripts/build-brand-icons.py /tmp/rs-icon-export.json
(async () =>
{
    const response = await fetch('/favicon/favicon.svg?v=rs-export')
    if(!response.ok) throw new Error('Cannot load canonical RS favicon')
    const url = URL.createObjectURL(new Blob([await response.text()], { type: 'image/svg+xml' }))
    try
    {
        const icon = new Image()
        icon.src = url
        await icon.decode()
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 512
        canvas.getContext('2d').drawImage(icon, 0, 0, 512, 512)
        return canvas.toDataURL('image/png')
    }
    finally { URL.revokeObjectURL(url) }
})()
