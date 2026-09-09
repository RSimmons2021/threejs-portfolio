/**
 * Synthesised cues for the walking layer.
 *
 * Everything here is generated with oscillators and filtered noise rather than
 * shipped as audio files: the cues are short, there are a lot of them, and a
 * portfolio should not pay 300kb to say "you worked a shift".
 *
 * The weights are deliberately unequal. Feedback should scale with consequence,
 * so a reversible action (opening a door) is a light tick, a milestone (a gated
 * project unlocking) is the heaviest thing in the walking layer, and a failure
 * that ends a run is a single low hit followed by silence — the absence is the
 * punctuation.
 */

// Peak gains, ordered by how much the action actually matters. Kept in one
// place so the ladder can be read at a glance rather than inferred from
// scattered magic numbers.
const WEIGHT = {
    tick: 0.022,
    light: 0.03,
    notable: 0.045,
    milestone: 0.07,
    failure: 0.075
}

/**
 * Cue name -> generated sample. Populated by scripts/generate-sounds.mjs; each
 * cue plays its sample when one has loaded and falls back to the synthesised
 * version below when it has not, so the walking layer is never silent whether
 * or not the audio has been regenerated.
 */
export const CUE_SAMPLES = {
    'door-job': 'cues/door-job.mp3',
    'door-trainer': 'cues/door-trainer.mp3',
    'door-shop': 'cues/door-shop.mp3',
    'door-home': 'cues/door-home.mp3',
    'door-arcade': 'cues/door-arcade.mp3',
    'door-project': 'cues/door-project.mp3',
    'door-locked': 'cues/door-locked.mp3',
    shift: 'cues/shift.mp3',
    'stat-gain': 'cues/stat-gain.mp3',
    unlock: 'cues/unlock.mp3',
    objective: 'cues/objective.mp3',
    purchase: 'cues/purchase.mp3',
    equip: 'cues/equip.mp3',
    'ruling-correct': 'cues/ruling-correct.mp3',
    'ruling-wrong': 'cues/ruling-wrong.mp3',
    breach: 'cues/breach.mp3',
    contained: 'cues/contained.mp3',
    'board-push': 'cues/board-push.mp3',
    'board-off': 'cues/board-off.mp3',
    'low-focus': 'cues/low-focus.mp3'
}

export default function createSoundCues(_context, _destination, _playSample = null)
{
    // Prefer the generated sample; synthesise only if it has not loaded.
    const sample = (_name, _fallback) => () =>
    {
        if(_playSample && _playSample(_name)) return
        _fallback()
    }

    const noiseBuffer = (() => {
        const length = Math.floor(_context.sampleRate * 0.6)
        const buffer = _context.createBuffer(1, length, _context.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
        return buffer
    })()

    // One shaped sine/triangle partial.
    const tone = ({ frequency, at = 0, duration = 0.4, gain = WEIGHT.light, type = 'sine', slideTo = null }) =>
    {
        const now = _context.currentTime + at
        const oscillator = _context.createOscillator()
        const envelope = _context.createGain()
        oscillator.type = type
        oscillator.frequency.setValueAtTime(frequency, now)
        if(slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration)
        envelope.gain.setValueAtTime(0, now)
        envelope.gain.linearRampToValueAtTime(gain, now + Math.min(0.03, duration * 0.2))
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)
        oscillator.connect(envelope)
        envelope.connect(_destination)
        oscillator.start(now)
        oscillator.stop(now + duration + 0.02)
    }

    // A burst of filtered noise: the percussive half of every physical cue.
    const noise = ({ at = 0, duration = 0.12, gain = WEIGHT.light, frequency = 1200, type = 'bandpass', q = 1 }) =>
    {
        const now = _context.currentTime + at
        const source = _context.createBufferSource()
        source.buffer = noiseBuffer
        const filter = _context.createBiquadFilter()
        filter.type = type
        filter.frequency.value = frequency
        filter.Q.value = q
        const envelope = _context.createGain()
        envelope.gain.setValueAtTime(0, now)
        envelope.gain.linearRampToValueAtTime(gain, now + 0.008)
        envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration)
        source.connect(filter)
        filter.connect(envelope)
        envelope.connect(_destination)
        source.start(now)
        source.stop(now + duration + 0.02)
    }

    // Each door kind sounds like the thing it is, so the taxonomy is learnable
    // by ear before the sign is close enough to read.
    const doors = {
        job: () => { noise({ frequency: 900, duration: 0.09, gain: WEIGHT.light }); tone({ frequency: 174.61, duration: 0.3, gain: WEIGHT.light, type: 'triangle' }) },
        trainer: () => { noise({ frequency: 2200, duration: 0.06, gain: WEIGHT.tick, type: 'highpass' }); tone({ frequency: 261.63, slideTo: 392, duration: 0.26, gain: WEIGHT.light }) },
        shop: () => { tone({ frequency: 987.77, duration: 0.18, gain: WEIGHT.tick }); tone({ frequency: 1318.51, at: 0.07, duration: 0.22, gain: WEIGHT.tick }) },
        home: () => { noise({ frequency: 420, duration: 0.16, gain: WEIGHT.light, type: 'lowpass' }); tone({ frequency: 130.81, duration: 0.42, gain: WEIGHT.light, type: 'triangle' }) },
        arcade: () => { tone({ frequency: 523.25, duration: 0.1, gain: WEIGHT.tick, type: 'square' }); tone({ frequency: 783.99, at: 0.06, duration: 0.12, gain: WEIGHT.tick, type: 'square' }) },
        project: () => { tone({ frequency: 329.63, duration: 0.5, gain: WEIGHT.light }); tone({ frequency: 493.88, at: 0.05, duration: 0.5, gain: WEIGHT.tick }) }
    }

    return {
        // --- doors -------------------------------------------------------
        door(_kind)
        {
            const kind = doors[_kind] ? _kind : 'job'
            sample(`door-${kind}`, doors[kind])()
        },

        // A latch that refuses. Dull, low, and over quickly: it should read as
        // "not yet", never as an error the visitor caused.
        doorLocked: sample('door-locked', () =>
        {
            noise({ frequency: 260, duration: 0.1, gain: WEIGHT.light, type: 'lowpass' })
            tone({ frequency: 98, duration: 0.16, gain: WEIGHT.tick, type: 'triangle' })
        }),

        // --- career ladder ----------------------------------------------
        // Reversible, routine: a stamp on a docket.
        shift: sample('shift', () =>
        {
            noise({ frequency: 620, duration: 0.08, gain: WEIGHT.notable, type: 'lowpass' })
            tone({ frequency: 196, duration: 0.22, gain: WEIGHT.light, type: 'triangle' })
        }),

        // A stat crossing a whole point. Rises, so gain reads as upward.
        statGain: sample('stat-gain', () =>
        {
            tone({ frequency: 440, duration: 0.16, gain: WEIGHT.light })
            tone({ frequency: 587.33, at: 0.08, duration: 0.2, gain: WEIGHT.light })
        }),

        // The heaviest cue in the walking layer: a gated project opening. Lock
        // releasing, then a rising triad that resolves.
        unlock: sample('unlock', () =>
        {
            noise({ frequency: 1800, duration: 0.09, gain: WEIGHT.light, type: 'highpass' })
            noise({ frequency: 300, at: 0.05, duration: 0.14, gain: WEIGHT.notable, type: 'lowpass' })
            tone({ frequency: 261.63, at: 0.12, duration: 0.5, gain: WEIGHT.milestone, type: 'triangle' })
            tone({ frequency: 329.63, at: 0.2, duration: 0.5, gain: WEIGHT.notable, type: 'triangle' })
            tone({ frequency: 392, at: 0.28, duration: 0.62, gain: WEIGHT.notable, type: 'triangle' })
        }),

        objective: sample('objective', () =>
        {
            tone({ frequency: 523.25, duration: 0.14, gain: WEIGHT.light })
            tone({ frequency: 659.25, at: 0.1, duration: 0.26, gain: WEIGHT.light })
        }),

        purchase: sample('purchase', () =>
        {
            tone({ frequency: 1244.51, duration: 0.09, gain: WEIGHT.light })
            tone({ frequency: 1661.22, at: 0.05, duration: 0.16, gain: WEIGHT.tick })
        }),

        // Cloth, not a chime: wearing something is a physical act.
        equip: sample('equip', () => { noise({ frequency: 3200, duration: 0.13, gain: WEIGHT.light, type: 'highpass' }) }),

        // --- arcade rulings ---------------------------------------------
        rulingCorrect: sample('ruling-correct', () => { tone({ frequency: 659.25, duration: 0.14, gain: WEIGHT.light }) }),
        rulingWrong: sample('ruling-wrong', () => { noise({ frequency: 220, duration: 0.16, gain: WEIGHT.notable, type: 'lowpass' }) }),

        // Containment lost. One low hit, then nothing — the silence after is
        // doing as much work as the hit itself, so nothing else is scheduled.
        breach: sample('breach', () =>
        {
            noise({ frequency: 160, duration: 0.4, gain: WEIGHT.failure, type: 'lowpass' })
            tone({ frequency: 73.42, duration: 0.75, gain: WEIGHT.failure, type: 'triangle' })
        }),

        contained: sample('contained', () =>
        {
            tone({ frequency: 392, duration: 0.3, gain: WEIGHT.milestone, type: 'triangle' })
            tone({ frequency: 587.33, at: 0.12, duration: 0.34, gain: WEIGHT.notable, type: 'triangle' })
            tone({ frequency: 783.99, at: 0.24, duration: 0.5, gain: WEIGHT.notable, type: 'triangle' })
        }),

        // --- skateboard --------------------------------------------------
        // The kick you give the pavement to build speed.
        boardPush: sample('board-push', () => { noise({ frequency: 1500, duration: 0.11, gain: WEIGHT.light, type: 'bandpass', q: 0.7 }) }),
        // Deck hitting the kerb as you step off.
        boardOff: sample('board-off', () =>
        {
            noise({ frequency: 800, duration: 0.09, gain: WEIGHT.notable, type: 'bandpass', q: 1.4 })
            tone({ frequency: 146.83, duration: 0.14, gain: WEIGHT.light, type: 'triangle' })
        }),

        // --- focus -------------------------------------------------------
        // Running out of the only resource the walking layer meters.
        lowFocus: sample('low-focus', () => { tone({ frequency: 116.54, duration: 0.5, gain: WEIGHT.tick, type: 'sine' }) })
    }
}
