import { CONTAINMENT_CASES, EVAL_QUESTIONS } from './careerData.js'

// Every game here resolves through onDone(passed, summary) exactly once and
// hands back a destroy() so CareerRPG can tear it down when the dialog closes,
// including mid-run. None of them touch the world; they only read input.

const shuffle = (_items) =>
{
    const list = [..._items]
    for(let i = list.length - 1; i > 0; i--)
    {
        const j = Math.floor(Math.random() * (i + 1))
        ;[list[i], list[j]] = [list[j], list[i]]
    }
    return list
}

const finish = (_state, _onDone, _passed, _summary) =>
{
    if(_state.done) return
    _state.done = true
    _onDone(_passed, _summary)
}

// BENCHMARK GYM / SYSTEMS — sustained throughput, not one heroic request.
export function loadTest($host, onDone)
{
    const target = 38
    const duration = 8000
    const state = { done: false, count: 0, started: 0, raf: 0 }

    $host.innerHTML = `
        <p class="career-game__lede">Serve traffic for 8 seconds. Target <strong>${target}k requests</strong>. Tap the pad or hit <kbd>Space</kbd>.</p>
        <div class="career-meter"><span></span></div>
        <p class="career-game__read"><strong data-count>0</strong>k / ${target}k · <span data-clock>8.0</span>s</p>
        <button class="career-pad" type="button" data-pad>SERVE</button>`

    const $bar = $host.querySelector('.career-meter span')
    const $count = $host.querySelector('[data-count]')
    const $clock = $host.querySelector('[data-clock]')
    const $pad = $host.querySelector('[data-pad]')

    const hit = () =>
    {
        if(state.done) return
        if(!state.started)
        {
            state.started = performance.now()
            tick()
        }
        state.count++
        $count.textContent = state.count
        $bar.style.transform = `scaleX(${Math.min(1, state.count / target)})`
        $pad.classList.remove('is-hit')
        void $pad.offsetWidth
        $pad.classList.add('is-hit')
    }

    const tick = () =>
    {
        const left = Math.max(0, duration - (performance.now() - state.started))
        $clock.textContent = (left / 1000).toFixed(1)
        if(left <= 0)
        {
            const passed = state.count >= target
            finish(state, onDone, passed, passed
                ? `${state.count}k requests held for the full window. p95 never drifted.`
                : `${state.count}k of ${target}k. The tail latency is where this falls over.`)
            return
        }
        state.raf = requestAnimationFrame(tick)
    }

    const key = (_event) =>
    {
        if(_event.code !== 'Space' || _event.repeat) return
        _event.preventDefault()
        hit()
    }

    $pad.addEventListener('pointerdown', hit)
    window.addEventListener('keydown', key)

    return { destroy() { state.done = true; cancelAnimationFrame(state.raf); window.removeEventListener('keydown', key) } }
}

// THE SIGNAL ROOM / PRODUCT — hear it before a metric agrees with you.
export function findTheBeat($host, onDone)
{
    const beats = 6
    const period = 900
    const state = { done: false, index: 0, hits: 0, start: performance.now(), raf: 0 }

    $host.innerHTML = `
        <p class="career-game__lede">Six beats. Land each one inside the window. Tap the pad or hit <kbd>Space</kbd>.</p>
        <div class="career-beat"><i></i><i></i><b data-head></b></div>
        <p class="career-game__read"><strong data-hits>0</strong> / ${beats} clean · <span data-verdict>listening</span></p>
        <button class="career-pad" type="button" data-pad>HIT</button>`

    const $head = $host.querySelector('[data-head]')
    const $hits = $host.querySelector('[data-hits]')
    const $verdict = $host.querySelector('[data-verdict]')
    const $pad = $host.querySelector('[data-pad]')

    const phase = () => ((performance.now() - state.start) % period) / period

    const hit = () =>
    {
        if(state.done) return
        const offset = Math.min(phase(), 1 - phase())
        const clean = offset < 0.09
        if(clean) state.hits++
        state.index++
        $hits.textContent = state.hits
        $verdict.textContent = clean ? 'on it' : offset < 0.16 ? 'close' : 'off'
        $pad.classList.toggle('is-hit', clean)
        setTimeout(() => $pad.classList.remove('is-hit'), 120)
        if(state.index >= beats)
        {
            const passed = state.hits >= 4
            finish(state, onDone, passed, passed
                ? `${state.hits}/${beats} clean. That is the ear that cut MusicGen before the metrics did.`
                : `${state.hits}/${beats}. Listen again — the window is tighter than it looks.`)
        }
    }

    const tick = () =>
    {
        $head.style.left = `${phase() * 100}%`
        state.raf = requestAnimationFrame(tick)
    }
    tick()

    const key = (_event) =>
    {
        if(_event.code !== 'Space' || _event.repeat) return
        _event.preventDefault()
        hit()
    }

    $pad.addEventListener('pointerdown', hit)
    window.addEventListener('keydown', key)

    return { destroy() { state.done = true; cancelAnimationFrame(state.raf); window.removeEventListener('keydown', key) } }
}

// WRIGHT STATE EVAL LAB / AI — the questions all have shipped answers.
export function sitTheEval($host, onDone)
{
    const questions = shuffle(EVAL_QUESTIONS).slice(0, 3)
    const state = { done: false, index: 0, correct: 0 }

    const render = () =>
    {
        const question = questions[state.index]
        $host.innerHTML = `
            <p class="career-game__lede">Question ${state.index + 1} of ${questions.length} · ${state.correct} verified</p>
            <p class="career-question">${question.q}</p>
            <div class="career-options">${question.options.map((_option, i) =>
                `<button type="button" data-option="${i}">${_option}</button>`).join('')}</div>
            <p class="career-game__note" data-note></p>`

        $host.querySelectorAll('[data-option]').forEach(($button) =>
        {
            $button.addEventListener('click', () =>
            {
                if(state.locked) return
                state.locked = true
                const picked = Number($button.dataset.option)
                const right = picked === question.answer
                if(right) state.correct++
                $host.querySelectorAll('[data-option]').forEach(($other, i) =>
                {
                    $other.disabled = true
                    if(i === question.answer) $other.classList.add('is-right')
                    else if(i === picked) $other.classList.add('is-wrong')
                })
                $host.querySelector('[data-note]').textContent = question.note
                setTimeout(() =>
                {
                    state.locked = false
                    state.index++
                    if(state.index >= questions.length)
                    {
                        const passed = state.correct >= 2
                        finish(state, onDone, passed, passed
                            ? `${state.correct}/${questions.length} verified. That is a pass in the harness too.`
                            : `${state.correct}/${questions.length}. Guessing scores the same here as it does in an eval suite.`)
                    }
                    else render()
                }, 1700)
            })
        })
    }

    render()
    return { destroy() { state.done = true } }
}

// THE CABINET / CONTAINMENT — Agent Relay as a coin-op. One wrong ruling ends
// the run, because a permission layer that is right most of the time is not one.
export function containment($host, onDone)
{
    const cases = shuffle(CONTAINMENT_CASES)
    const state = { done: false, index: 0, locked: false }

    const render = () =>
    {
        const item = cases[state.index]
        const pct = Math.round((state.index / cases.length) * 100)
        $host.innerHTML = `
            <p class="career-game__lede">Call ${state.index + 1} of ${cases.length} · containment <strong>${pct}%</strong></p>
            <div class="career-case">
                <p class="career-case__call">${item.call}</p>
                <p class="career-case__manifest">MANIFEST · ${item.manifest}</p>
            </div>
            <div class="career-options career-options--ruling">
                <button type="button" data-verdict="auto">AUTO_EXECUTE</button>
                <button type="button" data-verdict="approve">APPROVAL_REQUIRED</button>
                <button type="button" data-verdict="block">BLOCKED</button>
            </div>
            <p class="career-game__note" data-note>The manifest is the authority. You only apply it.</p>`

        $host.querySelectorAll('[data-verdict]').forEach(($button) =>
        {
            $button.addEventListener('click', () =>
            {
                if(state.locked) return
                state.locked = true
                const right = $button.dataset.verdict === item.verdict
                $host.querySelectorAll('[data-verdict]').forEach(($other) =>
                {
                    $other.disabled = true
                    if($other.dataset.verdict === item.verdict) $other.classList.add('is-right')
                    else if($other === $button) $other.classList.add('is-wrong')
                })
                $host.querySelector('[data-note]').textContent = item.note
                setTimeout(() =>
                {
                    if(!right)
                    {
                        finish(state, onDone, false, `Containment broke on call ${state.index + 1} of ${cases.length}. In CI this is a failed gate, not a warning.`)
                        return
                    }
                    state.locked = false
                    state.index++
                    if(state.index >= cases.length) finish(state, onDone, true, `${cases.length}/${cases.length}. Containment held at 100%, which is exactly where Agent Relay gates it.`)
                    else render()
                }, 1500)
            })
        })
    }

    render()
    return { destroy() { state.done = true } }
}
