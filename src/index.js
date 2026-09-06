import '@fontsource/archivo-black/latin-400.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import './style/main.css'
import Application from './javascript/Application.js'
import resumePdfUrl from '../docs/Richard_Simmons_Resume_AI.pdf'

for(const resumeLink of document.querySelectorAll('.js-resume'))
{
    resumeLink.href = resumePdfUrl
}

const showStartupFallback = (_error) =>
{
    console.error('The 3D portfolio could not start.', _error)

    const fallback = document.querySelector('.js-app-fallback')
    const message = document.querySelector('.js-app-fallback-message')
    const retry = document.querySelector('.js-app-fallback-retry')
    const status = document.querySelector('.js-app-status')

    if(message)
    {
        message.textContent = 'This browser could not initialize the 3D experience. Reload it, or use the portfolio links below.'
    }

    if(status)
    {
        status.hidden = true
    }

    if(fallback)
    {
        fallback.hidden = false
    }

    retry?.addEventListener('click', () => window.location.reload(), { once: true })
    document.body.classList.add('has-app-fallback')
}

try
{
    window.application = new Application({
        $canvas: document.querySelector('.js-canvas'),
        useComposer: true
    })
    const startButton = document.querySelector('.js-city-start')
    window.application.resources.on('ready', () =>
    {
        startButton.disabled = false
        startButton.textContent = 'ENTER SITE'
    })
    startButton.addEventListener('click', () => window.application.world.startingScreen.area.interact())
    document.addEventListener('keydown', (event) =>
    {
        if(event.key !== 'Enter' || event.repeat || startButton.disabled || document.body.classList.contains('has-started')) return
        if(event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return
        event.preventDefault()
        startButton.click()
    })
}
catch(error)
{
    showStartupFallback(error)
}
