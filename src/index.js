import './style/main.css'
import Application from './javascript/Application.js'
import resumePdfUrl from '../assets/Richard_Simmons__Resume.pdf'

const resumeLink = document.querySelector('.js-app-fallback-resume')
if(resumeLink)
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
}
catch(error)
{
    showStartupFallback(error)
}
