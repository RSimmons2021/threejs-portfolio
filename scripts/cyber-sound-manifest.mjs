// Original sound design, inspired by neon-noir cities and industrial sci-fi.
// No soundtrack, dialogue, recognisable melodies, or sampled game/movie audio.
// Separate paths preserve every original, especially the skateboard pack.
export const CYBER_SOUNDS = [
    ['drive', 6, true, 'Steady futuristic electric street car motor, deep rounded magnetic hum, restrained analog resonance and smooth midrange inverter whirr. Constant power, intimate cockpit perspective, no revving, no combustion, no music. Seamless loop.'],
    ['hover', 8, true, 'Futuristic flying car anti-gravity turbines hovering at constant power. Dense low magnetic drone, smooth ion thruster shimmer, quiet textured mechanical harmonics. No pulse, no changes in pitch or power, no music. Seamless loop.'],
    ['air', 6, true, 'Smooth air rushing around the cockpit of a flying car, layered soft filtered wind, high altitude neon megacity atmosphere. Constant speed, no gusts or whistles, no engine, no music. Seamless loop.'],
    ['transform-up', 1.8, false, 'One compact futuristic vehicle transforming from road wheels to flight pods: precise mechanical servo articulation, two heavy magnetic locks releasing, turbine spool rising into a short contained ion whoosh. Rich bass, clear metal detail, no explosion, no music.'],
    ['transform-down', 1.8, false, 'One futuristic flying car retracting its thrusters into road wheels: descending turbine power, synchronized tight hydraulic servo folds, two solid magnetic wheel locks clicking into place. Satisfying low mechanical finish, no impact crash, no music.'],
    ['interface', 0.5, false, 'One restrained futuristic holographic interface selection, tiny tactile digital click with a soft glassy resonant ping and very short granular tail. Sophisticated neon-noir terminal, no melody, no speech.'],
    ['door', 0.9, false, 'Single high tech street access door unlocking: precise magnetic latch, compact smooth pneumatic panel slide and soft digital confirmation, intimate dry mechanical texture, no music.'],
    ['home', 1.1, false, 'A cyberpunk capsule apartment security door opening once, subdued electronic latch and warm damped hydraulic slide. Quiet, intimate, comfortable after-hours interior, no speech or music.'],
    ['arcade', 0.7, false, 'Single futuristic arcade cabinet activation, tactile relay click followed by a compact energetic synthesized upward chirrup and bass tick. Modern neon gaming terminal, no retro tune, no speech.'],
    ['objective', 0.7, false, 'One concise futuristic task confirmation, soft two-part crystalline electronic pulse resolving upward, subtle warm analog undertone. Restrained tactile HUD feedback, no music, no speech.'],
    ['unlock', 1.2, false, 'Single important cyberpunk access unlock: heavy magnetic release, low synthetic bloom and a clean brief ascending glass resonance. Rewarding but restrained, not a cinematic trailer, no music or speech.'],
    ['wrong', 0.5, false, 'One restrained cyberpunk terminal refusal, soft low digital double tick with muted analog resonance, short, not harsh, no buzzer or alarm, no music.'],
    ['breach', 1, false, 'One serious futuristic security failure, deep contained electronic impact and short dark granular decay into silence. No explosion, no siren, no music or speech.'],
    ['impact', 0.7, false, 'One compact futuristic car body collision, damped composite-panel thump, tight metallic rattle and low chassis resonance. Physical and restrained, no glass break or explosion, no music.'],
    ['horn', 0.8, false, 'One short electric vehicle warning horn in a futuristic dense city, clear rounded dual tone with subtle synthetic mechanical edge. Civil, not loud or alarming, no melody or speech.'],
    ['city', 16, true, 'Distant neon megacity ambience from a quiet street canyon, layered low ventilation drones, far off electric traffic gliding, faint infrastructure resonance, broad calm atmospheric texture. No foreground events, no identifiable voices, no birds, no insects, no sirens, no music. Seamless loop.']
].map(([name, duration, loop, prompt]) => ({ group: 'cyber', file: `cyber/${name}.mp3`, duration, loop, influence: 0.7, prompt }))
