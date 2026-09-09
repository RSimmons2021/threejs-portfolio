#!/usr/bin/env node
/**
 * Regenerates every sound in the site with ElevenLabs sound generation.
 *
 *   ELEVENLABS_API_KEY=... node scripts/generate-sounds.mjs            # missing only
 *   ELEVENLABS_API_KEY=... node scripts/generate-sounds.mjs --force    # everything
 *   node scripts/generate-sounds.mjs --list                            # no API calls
 *   ELEVENLABS_API_KEY=... node scripts/generate-sounds.mjs --only=cues,engine
 *
 * Originals are copied to static/sounds-original/ before anything is written,
 * once, so a bad batch is always one `cp -r` from being undone.
 *
 * Generation is sequential on purpose: the endpoint is rate limited and a
 * failed batch halfway through is worse than a slow one.
 */
import { mkdir, writeFile, readFile, access, cp } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const OUT = path.join(ROOT, 'static/sounds')
const BACKUP = path.join(ROOT, 'static/sounds-original')
const ENDPOINT = 'https://api.elevenlabs.io/v1/sound-generation'

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const LIST = args.includes('--list')
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').replace('--only=', '').split(',').filter(Boolean)

// duration: seconds, or null to let the model choose.
// loop: ask for a seamless loop — only meaningful for the sustained layers.
// influence: 0 follows the prompt loosely, 1 follows it literally. Percussive
// one-shots want high influence; textures want a little freedom.
const MANIFEST = [
    // --- group: impacts -------------------------------------------------
    ...Array.from({ length: 8 }, (_, i) => ({
        group: 'impacts', file: `bricks/brick-${i + 1}.mp3`, duration: 0.8, influence: 0.75,
        prompt: 'A single short hollow wooden block knocking against a hard floor and settling, dry, close-mic, no reverb tail'
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
        group: 'impacts', file: `car-hits/car-hit-${i + 1}.mp3`, duration: 1.0, influence: 0.75,
        prompt: 'A short muffled car body panel impact, low thud with a brief metallic ring, no debris, no glass'
    })),
    { group: 'impacts', file: 'wood-hits/wood-hit-1.mp3', duration: 0.8, influence: 0.75,
      prompt: 'A single dry wooden plank knock, short and woody with a fast decay' },
    { group: 'impacts', file: 'bowling/pin-1.mp3', duration: 1.2, influence: 0.7,
      prompt: 'A bowling pin being struck and clattering briefly on a polished lane, light and hollow' },

    // --- group: car -----------------------------------------------------
    { group: 'car', file: 'screeches/screech-1.mp3', duration: 1.6, influence: 0.7,
      prompt: 'Car tyres chirping and losing traction on dry tarmac for a moment, short skid, no crash' },
    { group: 'car', file: 'car-horns/car-horn-1.mp3', duration: 0.9, influence: 0.8,
      prompt: 'A short single beep of a small city car horn, friendly, one press' },
    { group: 'car', file: 'car-horns/car-horn-2.mp3', duration: 1.4, influence: 0.8,
      prompt: 'Two quick polite taps of a small car horn' },
    ...Array.from({ length: 3 }, (_, i) => ({
        group: 'car', file: `horns/horn-${i + 1}.mp3`, duration: 1.2, influence: 0.8,
        prompt: 'A short bright car horn honk, single press, clean and dry'
    })),

    // --- group: engine ---------------------------------------------------
    // One loop, pitch-shifted. setEngine() already works this way: it loads a
    // single file and sweeps playbackRate 0.4 -> 1.4, so the eight other RPM
    // clips on disk were never actually played. Generating one coherent loop
    // is both cheaper and the only way the rev sweep stays one engine.
    { group: 'engine', file: 'engines/1/engine-loop.mp3', duration: 5.0, loop: true, influence: 0.85,
      prompt: 'A smooth warm electric motor humming steadily at constant speed, soft rounded low frequency drone with a gentle whir, pleasant and quiet, no rattle, no combustion, no exhaust, no revving, no pitch changes, no music, seamless continuous loop' },

    // Sustained tyre squeal, generated as its own loop so the one-shot chirp
    // below can be replaced without breaking a hardcoded sprite range.
    { group: 'engine', file: 'tires/tire-loop.mp3', duration: 3.0, loop: true, influence: 0.8,
      prompt: 'Rubber tyres squealing continuously while sliding on dry tarmac, steady sustained squeal, no engine, no crash, no music' },

    // --- group: ui --------------------------------------------------------
    { group: 'ui', file: 'ui/area-1.mp3', duration: 0.6, influence: 0.6,
      prompt: 'A soft short synthetic interface blip, warm and rounded, single note, quiet' },
    { group: 'ui', file: 'reveal/reveal-1.mp3', duration: 3.5, influence: 0.4,
      prompt: 'A short calm ambient startup chime in the style of the Windows 95 startup sound, soft warm synthesiser bells and pads, gentle and welcoming, slow attack, resolves and fades naturally, no riser, no swell, no drums, no impact, quiet and unhurried' },

    // --- group: cues ------------------------------------------------------
    // The walking layer. These replace the synthesised versions in soundCues.js.
    { group: 'cues', file: 'cues/door-job.mp3', duration: 1.0, influence: 0.7,
      prompt: 'A heavy office door unlatching and swinging open onto a quiet room, single motion' },
    { group: 'cues', file: 'cues/door-trainer.mp3', duration: 1.0, influence: 0.7,
      prompt: 'A light gym door pushing open with a soft metal bar release' },
    { group: 'cues', file: 'cues/door-shop.mp3', duration: 1.2, influence: 0.7,
      prompt: 'A small shop door opening with a little bell chime above it' },
    { group: 'cues', file: 'cues/door-home.mp3', duration: 1.2, influence: 0.7,
      prompt: 'A apartment front door unlocking and opening into a carpeted hallway, warm and close' },
    { group: 'cues', file: 'cues/door-arcade.mp3', duration: 1.0, influence: 0.6,
      prompt: 'A short bright retro arcade cabinet start jingle, two ascending chiptune notes' },
    { group: 'cues', file: 'cues/door-project.mp3', duration: 1.4, influence: 0.6,
      prompt: 'A smooth soft synthetic panel sliding open, airy and clean, science lab feel' },
    { group: 'cues', file: 'cues/door-locked.mp3', duration: 0.7, influence: 0.8,
      prompt: 'A door handle rattling against a lock that will not open, short dull refusal, no alarm' },

    { group: 'cues', file: 'cues/shift.mp3', duration: 0.8, influence: 0.75,
      prompt: 'A rubber stamp pressed firmly onto paper on a desk, single dry thud' },
    { group: 'cues', file: 'cues/stat-gain.mp3', duration: 0.9, influence: 0.6,
      prompt: 'A short warm two note rising synthetic chime, gentle, positive, quiet' },
    { group: 'cues', file: 'cues/unlock.mp3', duration: 2.2, influence: 0.6,
      prompt: 'A heavy lock releasing then a warm rising three note synthetic chord resolving, achievement, no drums' },
    { group: 'cues', file: 'cues/objective.mp3', duration: 1.0, influence: 0.6,
      prompt: 'A short crisp two note completion chime, light and bright, quiet' },
    { group: 'cues', file: 'cues/purchase.mp3', duration: 0.9, influence: 0.7,
      prompt: 'A small shop till register ping, single bright metallic chime' },
    { group: 'cues', file: 'cues/equip.mp3', duration: 0.7, influence: 0.75,
      prompt: 'Fabric clothing being pulled on quickly, short cloth rustle, close mic' },

    { group: 'cues', file: 'cues/ruling-correct.mp3', duration: 0.6, influence: 0.65,
      prompt: 'A short clean single note confirmation blip, soft and affirmative' },
    { group: 'cues', file: 'cues/ruling-wrong.mp3', duration: 0.7, influence: 0.7,
      prompt: 'A dull low muted thunk of a wrong answer, short, no buzzer, not harsh' },
    { group: 'cues', file: 'cues/breach.mp3', duration: 1.8, influence: 0.7,
      prompt: 'A single deep low impact hit with a short dark tail, serious failure, no music, no alarm' },
    { group: 'cues', file: 'cues/contained.mp3', duration: 2.2, influence: 0.6,
      prompt: 'A calm warm three note ascending resolution, quietly triumphant, synthetic, no drums' },

    { group: 'cues', file: 'cues/board-push.mp3', duration: 0.8, influence: 0.75,
      prompt: 'A skateboarder pushing once off concrete with a shoe, single scrape and roll' },
    { group: 'cues', file: 'cues/board-off.mp3', duration: 0.8, influence: 0.75,
      prompt: 'A skateboard deck clacking down onto concrete as someone steps off, single wooden knock' },
    { group: 'cues', file: 'cues/board-roll.mp3', duration: 4.0, loop: true, influence: 0.75,
      prompt: 'Skateboard wheels rolling steadily on smooth concrete, constant speed, close mic, no music' },
    { group: 'cues', file: 'cues/low-focus.mp3', duration: 1.4, influence: 0.55,
      prompt: 'A soft low synthetic warning pulse, single, warm and non alarming, quiet' }
]

const selected = MANIFEST.filter((s) => !ONLY.length || ONLY.includes(s.group))

if(LIST)
{
    const byGroup = selected.reduce((acc, s) => { (acc[s.group] ||= []).push(s); return acc }, {})
    for(const [group, items] of Object.entries(byGroup))
    {
        console.log(`\n${group} (${items.length})`)
        for(const item of items) console.log(`  ${item.file.padEnd(34)} ${item.duration ?? 'auto'}s${item.loop ? ' loop' : ''}`)
    }
    const seconds = selected.reduce((n, s) => n + (s.duration ?? 4), 0)
    console.log(`\n${selected.length} files, ~${Math.round(seconds)}s of audio total`)
    process.exit(0)
}

const key = process.env.ELEVENLABS_API_KEY
if(!key)
{
    console.error('ELEVENLABS_API_KEY is not set. Run with --list to see what would be generated.')
    process.exit(1)
}

// Snapshot the originals once, before the first write.
if(!existsSync(BACKUP))
{
    await cp(OUT, BACKUP, { recursive: true })
    console.log(`Backed up existing sounds to ${path.relative(ROOT, BACKUP)}`)
}

let made = 0, skipped = 0, failed = 0

for(const [index, item] of selected.entries())
{
    const target = path.join(OUT, item.file)
    const label = `[${index + 1}/${selected.length}] ${item.file}`

    if(!FORCE && existsSync(target))
    {
        console.log(`${label} — exists, skipping`)
        skipped++
        continue
    }

    const body = {
        text: item.prompt,
        output_format: 'mp3_44100_128',
        prompt_influence: item.influence ?? 0.3
    }
    if(item.duration) body.duration_seconds = item.duration
    if(item.loop) body.loop = true

    const send = (payload) => fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })

    try
    {
        let response = await send(body)

        // Older deployments of the endpoint reject the seamless-loop flag. Fall
        // back rather than losing the whole sustained-layer group to a 422.
        if(response.status === 422 && body.loop)
        {
            const { loop, ...withoutLoop } = body
            response = await send(withoutLoop)
            if(response.ok) console.warn(`${label} — loop unsupported, generated unlooped`)
        }

        if(!response.ok)
        {
            const detail = await response.text()
            console.error(`${label} — FAILED ${response.status}: ${detail.slice(0, 200)}`)
            failed++
            // 401/402 will not fix themselves; stop rather than burn the list.
            if(response.status === 401 || response.status === 402) break
            continue
        }

        const buffer = Buffer.from(await response.arrayBuffer())
        await mkdir(path.dirname(target), { recursive: true })
        await writeFile(target, buffer)
        console.log(`${label} — ${(buffer.length / 1024).toFixed(0)}kb`)
        made++
    }
    catch(error)
    {
        console.error(`${label} — ERROR ${error.message}`)
        failed++
    }
}

console.log(`\nGenerated ${made}, skipped ${skipped}, failed ${failed}.`)
if(failed) process.exitCode = 1
