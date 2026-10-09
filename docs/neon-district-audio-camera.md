# Cyberpunk sound, camera and apartment update

Implemented 2026-10-09. Original neon-noir/industrial sci-fi sound design inspired by the requested mood, not sampled music or dialogue from Cyberpunk 2077 or Blade Runner 2049.

## ElevenLabs pack

Sixteen stereo MP3s generated with the configured server-side ElevenLabs key and `eleven_text_to_sound_v2`, using the [official sound-effects endpoint](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert). About 47.7 seconds authored, 777,667 bytes after constant-gain mastering. Every file decodes; highest decoded peak after mastering: −3.41 dBFS. No frontend credentials.

`static/sounds/cyber/`: drive, hover, air, transform-up, transform-down, interface, door, home, arcade, objective, unlock, wrong, breach, impact, horn and city. Prompts/durations live in `scripts/cyber-sound-manifest.mjs`.

- `npm run sounds:cyber` generates missing new-pack files only. Existing files are skipped, so this does not spend more credits unless a file is missing. `.env` supplies the key.
- `npm run sounds:master` masters only this pack. Raw copies are preserved in ignored `static/sounds-original/cyber/`. Old site audio files remain available; none was deleted.
- Road motor crossfades against the hover turbine. Flight airflow responds to speed/boost; takeoff and landing have distinct mechanical transformations. Ground motor pauses on foot, flight loops stop when inaudible, and generated ambient/flight loops stop in hidden tabs. All use the existing Howler context, volume/mute and world ducking.
- City infrastructure/traffic ambience replaces countryside birds/crickets in Neon mode. Procedural rain/wind and the apartment enclosure remain.
- Intro/reveal sound is no longer registered or played.
- **Skateboard roll, push and step-off files and their playback settings are unchanged.** SHA-256 regression checks protect all three.
- Follow-up tuning: flight airflow uses a barely audible 0.018 idle gain, rising to at most 0.07 with actual 3D velocity (including vertical movement and game-owned flight). City ambience is capped at 0.06 before master/ducking and attenuates with height and indoors. No new generation/API spend was needed for this tuning.

## Camera corrections

Two coupled causes: the smoothed pose advanced once per reader, and the render callback was registered before the asynchronously constructed world ticks. `Time` now emits a final `render` phase after every simulation tick; body poses are sampled once per frame and shared by visual models and cameras. Vehicle orientation is smoothed alongside position. The first-person eye attaches to the exact visible chassis transform, including flight bank/bob; view direction keeps a level horizon. First person ignores collision shake, and ground-plane contact no longer shakes the entry descent. Chase follow uses the rendered subject in walking/skateboarding and resets cleanly after teleports. The classic camera no longer overwrites the active chase/first-person view during simulation: that invisible overwrite had rotated walking/touch input away from the visible camera.

The cockpit follow-up now reads `hover-car.json → cockpit.eye.meshFrame` directly: local `[-0.05, 0, 0.92]`, not the 0.64 m **physics-body** eye offset. The visible chassis already has a −0.28 m offset, so using 0.64 locally had lowered the eye twice. View attachment, smoothing, near plane and shake suppression are preserved. `flightRules.js` sets a 160 m ceiling and eases climb from 150 m; entry columns share that ceiling plus 2 m.

## Apartment

Neon mode now loads the supplied cyberpunk `apartment-interior.glb`, preserving the shell, furniture, monitors, posters and mapped `apartment_window.jpg`. Dedicated cheap cel-banded indoor lighting uses the existing atlas/emission mask and baked vertex AO; no extra shadow maps, real-time reflection captures or Three.js lights. Independent of outdoor clock/weather lighting. Closed-door and furniture collisions prevent walking through geometry. Bed/lab/leave stations remain; the room hides on exit. Indoor controls use the existing cyan/slate palette, with separated prompt/action bars and no redundant car/skate/view buttons indoors; mobile movement controls stay available.

## Verification

- `npm run test:camera-audio`: render ordering, per-frame position/quaternion coherence, vehicle sound mixing, new-pack budget and untouched skateboard hashes.
- `scripts/camera-interior.browser.js`: real entry descent, actual walking/skateboard movement and follow, driving/flying cockpit attachment, loaded hover sound, road/flight mixing, apartment assets/materials/collisions/stations and leave cleanup. Desktop and 412 × 915 touch-layout runs both passed 22 checks, measured **0 m cockpit-eye drift**, **0 intro shake**, and no runtime/shader errors. The actual camera-relative touch-movement suite passed 20 checks; career 44, explorer 17 desktop / 18 touch, aerial entry/skate 17, Neon 30 and six-game lifecycle 140 also passed. After the visitor-play follow-up, all 59 Node tests and the production build passed; see `neon-district-minigames.md` and `neon-district-perf.md` for the new delivery/practice/ceiling checks and laptop measurement.
- Apartment daylight, night and touch-layout captures are in `docs/screenshots/neon-district/apartment-wired-*.png`. Indoors the joystick remains available, while redundant accelerator/brake/boost controls are hidden to leave room for the action bar and drag-to-look.
- `scripts/follow-input.browser.js` passed all 10 live-frame checks: walking and skating in four camera headings plus orbited strafing. Separate mobile checks confirmed no action-bar/joystick overlap and clean room exit when using navigation; browser errors remained empty.
- The physical Nothing Phone (3) **35 FPS sustained** gate remains pending. These fixes do not constitute a phone performance result.
