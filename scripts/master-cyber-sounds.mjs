// Constant-gain mastering only; keep the originals and the authored loop shape.
import { spawnSync } from 'node:child_process'
import { copyFile, rename, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { CYBER_SOUNDS } from './cyber-sound-manifest.mjs'
import { BOWLING_SOUNDS } from './bowling-sound-manifest.mjs'

const root = path.resolve(import.meta.dirname, '..')
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7)
const entries = only === 'bowling' ? BOWLING_SOUNDS : CYBER_SOUNDS
for(const entry of entries)
{
    const file = path.join(root, 'static/sounds', entry.file)
    const raw = path.join(root, 'static/sounds-original', entry.file)
    if(!existsSync(raw)) { await mkdir(path.dirname(raw), { recursive: true }); await copyFile(file, raw) }
    const analysis = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'astats=metadata=0:reset=0', '-f', 'null', '-'], { encoding: 'utf8' })
    if(analysis.status !== 0) throw new Error(`Cannot decode ${entry.file}`)
    const peaks = [...analysis.stderr.matchAll(/Peak level dB: (-?[\d.]+)/g)]
    const peak = Number(peaks.at(-1)?.[1])
    if(!Number.isFinite(peak)) throw new Error(`Cannot measure ${entry.file}`)
    const target = entry.file.includes('/city.') ? -10 : entry.file.includes('/air.') ? -8 : -4
    const temp = `${file}.master.mp3`
    const encode = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-af', `volume=${target - peak}dB`, '-c:a', 'libmp3lame', '-b:a', '128k', temp], { encoding: 'utf8' })
    if(encode.status !== 0) throw new Error(`Cannot master ${entry.file}`)
    await rename(temp, file)
    console.log(`${entry.file}: ${peak.toFixed(1)} -> ${target} dBFS target`)
}
