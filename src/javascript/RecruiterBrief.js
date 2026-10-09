import { BUILDINGS, PROFILE } from './World/careerData.js'
import projects from './World/Sections/projectCatalog.js'

/**
 * The sixty-second version of this portfolio.
 *
 * A recruiter screening thirty candidates will not drive a car around a city to
 * find out whether you can do the job, and a portfolio that only works if they
 * do is a portfolio that loses to a PDF. This is the fast path: everything the
 * 3D site says, on one scrollable page, reachable in one click from the intro.
 *
 * It is built from shared career and project data — no three.js,
 * no WebGL, no Application. That means it still works on the locked-down
 * corporate laptop where the 3D experience fails to start, which is exactly the
 * machine a recruiter is most likely to be using.
 */
export default class RecruiterBrief
{
    constructor()
    {
        this.$element = null
        this.lastFocused = null
    }

    // Built once, on first open: the intro should not pay for markup nobody
    // has asked for yet.
    build()
    {
        if(this.$element) return this.$element

        const jobs = BUILDINGS.filter((_b) => _b.kind === 'job' && _b.shifts)

        const dialog = document.createElement('dialog')
        dialog.className = 'brief'
        dialog.setAttribute('aria-labelledby', 'brief-title')
        dialog.innerHTML = `
            <article class="brief__sheet">
                <header class="brief__head">
                    <p class="brief__eyebrow">THE 60-SECOND VERSION</p>
                    <h1 id="brief-title">${PROFILE.name}<span>${PROFILE.title} · ${PROFILE.location}</span></h1>
                    <p class="brief__pitch">${PROFILE.pitch}</p>
                    <div class="brief__contact">
                        ${PROFILE.contact.map((_c) => `<a href="${_c.href}"${_c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><b>${_c.label}</b>${_c.value}</a>`).join('')}
                        <a class="brief__contact-resume js-resume" href="#" download="Richard_Simmons_Resume_AI.pdf" aria-label="Download Richard Simmons’s résumé as a PDF"><b>Résumé</b>PDF ↓</a>
                        <button type="button" data-brief="copy-email">Copy email</button>
                    </div>
                    <p class="brief__copy-status" role="status" aria-live="polite"></p>
                    <button class="brief__close" type="button" data-brief="close">Close <kbd>Esc</kbd></button>
                </header>

                <nav class="brief__nav" aria-label="Portfolio overview sections">
                    <a href="#brief-overview">Overview</a>
                    <a href="#brief-work">Selected work <span>06</span></a>
                    <a href="#brief-experience">Experience</a>
                    <a href="#brief-stack">Stack</a>
                </nav>
                <section class="brief__section" id="brief-overview">
                    <h2>What I'd bring</h2>
                    <ul class="brief__headlines">
                        ${PROFILE.headlines.map((_h) => `<li>${_h}</li>`).join('')}
                    </ul>
                </section>

                <section class="brief__section" id="brief-work">
                    <h2>Selected work</h2>
                    <p class="brief__guide">Start here for the projects. Each entry includes my role, the build, and a direct link; no game progress is required.</p>
                    <div class="brief__projects">
                        ${projects.map((_p, index) => `
                            <article class="brief__project">
                                <p class="brief__stack">0${index + 1} / ${_p.eyebrow}</p>
                                <h3>${_p.name}<a href="${_p.href}" target="_blank" rel="noopener" aria-label="Open ${_p.name} ${_p.slug === 'deepseek' ? 'repository' : 'project'} in a new tab">${_p.slug === 'deepseek' ? 'Repository' : 'View project'} ↗</a></h3>
                                <p class="brief__lede">${_p.built}</p>
                                <dl class="brief__project-facts"><div><dt>Role</dt><dd>${_p.role}</dd></div><div><dt>System</dt><dd>${_p.stack}</dd></div><div><dt>Outcome</dt><dd>${_p.outcome}</dd></div></dl>
                            </article>`).join('')}
                    </div>
                </section>

                <section class="brief__section" id="brief-experience">
                    <h2>Experience</h2>
                    <div class="brief__roles">
                        ${jobs.map((_j) => `
                            <article class="brief__role">
                                <h3>${_j.name}</h3>
                                <p class="brief__meta">${_j.eyebrow}</p>
                                <p class="brief__lede">${_j.intro}</p>
                                <ul>${_j.shifts.map((_s) => `<li><b>${_s.title}.</b> ${_s.body}</li>`).join('')}</ul>
                            </article>`).join('')}
                    </div>
                </section>

                <section class="brief__section" id="brief-stack">
                    <h2>Stack</h2>
                    <dl class="brief__skills">
                        ${PROFILE.skills.map((_s) => `<div><dt>${_s.group}</dt><dd>${_s.items.join(' · ')}</dd></div>`).join('')}
                    </dl>
                    <p class="brief__education">${PROFILE.education.degree} — ${PROFILE.education.school}, ${PROFILE.education.year}</p>
                </section>

                <footer class="brief__foot">
                    <p>There is a whole city behind this page if you want it.</p>
                    <button type="button" data-brief="explore">Explore the 3D portfolio →</button>
                </footer>
            </article>`

        dialog.addEventListener('click', (_event) =>
        {
            const action = _event.target.closest('[data-brief]')?.dataset.brief
            if(action === 'close') this.close()
            if(action === 'copy-email') this.copyEmail()
            if(action === 'explore')
            {
                this.close()
                document.querySelector('.js-city-start')?.click()
            }
            // Clicking the backdrop closes, the sheet itself does not.
            if(_event.target === dialog) this.close()
        })
        // Esc is handled by the browser and its close event is queued, so the
        // body class would linger for a frame. Drop it on cancel as well.
        dialog.addEventListener('cancel', () => this.setOpenState(false))
        dialog.addEventListener('close', () => this.restoreFocus())

        document.body.appendChild(dialog)
        this.$element = dialog

        // The résumé link inside the brief needs the same bundled URL the intro
        // links use; index.js resolves those after this markup exists.
        document.dispatchEvent(new CustomEvent('brief:built'))
        return dialog
    }

    open()
    {
        const dialog = this.build()
        if(dialog.open) return
        this.lastFocused = document.activeElement
        dialog.showModal()
        dialog.scrollTop = 0
        this.setOpenState(true)
        dialog.querySelector('.brief__close')?.focus({ preventScroll: true })
    }

    close()
    {
        if(this.$element?.open) this.$element.close()
        this.setOpenState(false)
    }

    restoreFocus()
    {
        this.setOpenState(false)
        if(this.lastFocused instanceof HTMLElement) this.lastFocused.focus({ preventScroll: true })
        this.lastFocused = null
    }

    setOpenState(open)
    {
        document.body.classList.toggle('has-brief', open)
        window.dispatchEvent(new CustomEvent('portfolio:brief-state', { detail: { open } }))
    }

    async copyEmail()
    {
        const email = PROFILE.contact.find(contact => contact.href.startsWith('mailto:'))?.href.slice(7)
        if(!email) return
        const status = this.$element.querySelector('.brief__copy-status')
        try
        {
            await navigator.clipboard.writeText(email)
            status.textContent = 'Email copied. Ready to paste.'
        }
        catch
        {
            status.textContent = `Copy unavailable. You can select this address: ${email}`
        }
    }
}
