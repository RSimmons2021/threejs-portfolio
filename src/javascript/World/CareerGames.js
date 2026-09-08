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

// BENCHMARK GYM / SYSTEMS — a live traffic graph. Requests scroll right to
// left, your tap rate drives throughput, and the p95 line climbs whenever the
// queue drains slower than it fills.
export function loadTest($host, onDone)
{
    const duration = 9000
    const target = 34
    const state = { done: false, count: 0, started: 0, raf: 0, rate: 0, p95: 0.18, history: [], flash: 0 }

    $host.innerHTML = `
        <p class="career-game__lede">Hold the line for 9 seconds. Land <strong>${target}k requests</strong> and keep p95 out of the red. Tap the pad or hit <kbd>Space</kbd>.</p>
        <canvas class="career-canvas" width="640" height="220"></canvas>
        <p class="career-game__read"><strong data-count>0</strong>k served · p95 <span data-p95>ok</span> · <span data-clock>9.0</span>s</p>
        <button class="career-pad" type="button" data-pad>SERVE</button>`

    const canvas = $host.querySelector('canvas')
    const ctx = canvas.getContext('2d')
    const $count = $host.querySelector('[data-count]')
    const $p95 = $host.querySelector('[data-p95]')
    const $clock = $host.querySelector('[data-clock]')
    const $pad = $host.querySelector('[data-pad]')

    const hit = () =>
    {
        if(state.done) return
        if(!state.started) { state.started = performance.now(); tick() }
        state.count++
        state.rate = Math.min(1, state.rate + 0.14)
        state.flash = 1
        $count.textContent = state.count
    }

    const draw = (left) =>
    {
        const w = canvas.width, h = canvas.height
        ctx.clearRect(0, 0, w, h)
        ctx.fillStyle = '#16130e'
        ctx.fillRect(0, 0, w, h)

        // SLO band: stay above it
        ctx.fillStyle = 'rgba(194, 65, 45, 0.22)'
        ctx.fillRect(0, h - 46, w, 46)
        ctx.strokeStyle = 'rgba(194, 65, 45, 0.8)'
        ctx.setLineDash([6, 5])
        ctx.beginPath(); ctx.moveTo(0, h - 46); ctx.lineTo(w, h - 46); ctx.stroke()
        ctx.setLineDash([])

        // Throughput history as scrolling bars
        const bars = state.history
        const bw = w / 64
        for(let i = 0; i < bars.length; i++)
        {
            const v = bars[i]
            const bh = Math.max(2, v * (h - 20))
            ctx.fillStyle = v > 0.34 ? '#187575' : '#c2412d'
            ctx.fillRect(i * bw, h - bh, bw - 1.5, bh)
        }

        // p95 needle
        const y = h - 12 - state.p95 * (h - 40)
        ctx.strokeStyle = '#ffca62'
        ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
        ctx.fillStyle = '#ffca62'
        ctx.font = 'bold 15px monospace'
        ctx.fillText('p95', 8, y - 7)

        // Request pulse on every tap
        if(state.flash > 0.02)
        {
            ctx.fillStyle = `rgba(134, 222, 215, ${state.flash * 0.5})`
            ctx.fillRect(0, 0, w, h)
            state.flash *= 0.82
        }

        ctx.fillStyle = '#fff0d2'
        ctx.font = 'bold 17px monospace'
        ctx.fillText(`${(left / 1000).toFixed(1)}s`, w - 66, 26)
    }

    let last = performance.now()
    const tick = () =>
    {
        const now = performance.now()
        const dt = Math.min((now - last) / 1000, 0.05)
        last = now
        const left = Math.max(0, duration - (now - state.started))
        $clock.textContent = (left / 1000).toFixed(1)

        state.rate = Math.max(0, state.rate - dt * 0.72)
        state.history.push(state.rate)
        if(state.history.length > 64) state.history.shift()
        // Falling behind pushes the tail latency up; keeping pace pulls it back.
        state.p95 = Math.max(0.05, Math.min(1, state.p95 + (state.rate < 0.34 ? dt * 0.42 : - dt * 0.5)))
        $p95.textContent = state.p95 > 0.72 ? 'blown' : state.p95 > 0.4 ? 'drifting' : 'ok'

        draw(left)

        if(left <= 0)
        {
            const passed = state.count >= target && state.p95 < 0.72
            finish(state, onDone, passed, passed
                ? `${state.count}k served with p95 held. That is the shape of a million a day: boring, repeatedly.`
                : state.count < target
                    ? `${state.count}k of ${target}k. Throughput was the easy half.`
                    : `${state.count}k served, but p95 blew out. Average latency was never the number that mattered.`)
            return
        }
        state.raf = requestAnimationFrame(tick)
    }
    draw(duration)

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

// THE SIGNAL ROOM / PRODUCT — a scrolling waveform. Bars ride in from the
// right and you hit them as they cross the playhead; the take is scored on how
// close you were, not whether you pressed.
export function findTheBeat($host, onDone)
{
    const beats = 8
    const period = 850
    const state = { done: false, index: 0, hits: 0, raf: 0, start: performance.now(), pops: [], verdict: '' }

    $host.innerHTML = `
        <p class="career-game__lede">Eight bars. Hit each one as it crosses the head. Tap the pad or hit <kbd>Space</kbd>.</p>
        <canvas class="career-canvas" width="640" height="200"></canvas>
        <p class="career-game__read"><strong data-hits>0</strong> / ${beats} clean · <span data-verdict>listening</span></p>
        <button class="career-pad" type="button" data-pad>HIT</button>`

    const canvas = $host.querySelector('canvas')
    const ctx = canvas.getContext('2d')
    const $hits = $host.querySelector('[data-hits]')
    const $verdict = $host.querySelector('[data-verdict]')
    const $pad = $host.querySelector('[data-pad]')

    const elapsed = () => performance.now() - state.start
    const phase = () => (elapsed() % period) / period

    const hit = () =>
    {
        if(state.done) return
        const p = phase()
        const offset = Math.min(p, 1 - p)
        const clean = offset < 0.085
        const close = offset < 0.15
        if(clean) state.hits++
        state.index++
        state.verdict = clean ? 'on it' : close ? 'close' : 'off'
        state.pops.push({ life: 1, clean })
        $hits.textContent = state.hits
        $verdict.textContent = state.verdict
        if(state.index >= beats)
        {
            const passed = state.hits >= 5
            finish(state, onDone, passed, passed
                ? `${state.hits}/${beats} clean. That is the ear that cut MusicGen months before a metric agreed.`
                : `${state.hits}/${beats}. The window is tighter than it looks, which is the point.`)
        }
    }

    const draw = () =>
    {
        const w = canvas.width, h = canvas.height, mid = h / 2
        ctx.clearRect(0, 0, w, h)
        ctx.fillStyle = '#16130e'
        ctx.fillRect(0, 0, w, h)

        // Waveform: bars scroll leftwards, one per beat
        const t = elapsed() / period
        for(let i = -1; i < 9; i++)
        {
            const x = w * 0.5 + (i - (t % 1)) * (w * 0.25)
            if(x < -30 || x > w + 30) continue
            const strong = true
            const bh = strong ? h * 0.34 : h * 0.2
            ctx.fillStyle = 'rgba(147, 214, 208, 0.85)'
            ctx.fillRect(x - 5, mid - bh, 10, bh * 2)
        }

        // Playhead and its hit window
        ctx.fillStyle = 'rgba(24, 117, 117, 0.3)'
        ctx.fillRect(w * 0.5 - w * 0.021, 0, w * 0.042, h)
        ctx.strokeStyle = '#c2412d'
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(w * 0.5, 0); ctx.lineTo(w * 0.5, h); ctx.stroke()

        // Hit feedback rings
        for(const pop of state.pops)
        {
            pop.life *= 0.9
            if(pop.life < 0.03) continue
            ctx.strokeStyle = pop.clean ? `rgba(24,117,117,${pop.life})` : `rgba(194,65,45,${pop.life})`
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(w * 0.5, mid, (1 - pop.life) * 70 + 12, 0, Math.PI * 2)
            ctx.stroke()
        }
        state.pops = state.pops.filter((_pop) => _pop.life >= 0.03)

        ctx.fillStyle = '#fff0d2'
        ctx.font = 'bold 15px monospace'
        ctx.fillText(state.verdict.toUpperCase(), 12, 26)

        state.raf = requestAnimationFrame(draw)
    }
    draw()

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
