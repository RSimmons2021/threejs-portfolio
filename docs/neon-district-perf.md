# Neon District: Runtime State and Performance

Updated 2026-10-09, after project-board, crowd and six-game wiring, plus skateboard stance and aerial entry. **Not yet verified on the physical phone.** The target phone is the Nothing Phone (3); the target is **at least 35 fps sustained**. The earlier laptop run below does **not** meet that target.

## What's running (default URL; `?neon=0` keeps the legacy city)

| Area | Implementation |
|---|---|
| City | `World/NeonCity.js`. The **whole district** from `district-layout.json`: 55 towers, 5 skybridges, 4 pads, street props, signs, a skyline ring. One `InstancedMesh` per module, material and LOD for the entire city; every 100 ms the CPU repacks each mesh with only the instances inside the camera frustum (LOD0 within 50 m, LOD1 beyond; greebles to 80 m). Collision: towers, bridges, pads and street props, plus a box list the camera uses for collision. The old Manhattan towers, NYC signs, trees, fake shadows and cartoon sky/floor are hidden in Neon mode; the street surface stays. |
| Material | `World/CyberMaterials.js` + `shaders/cyber/*`. Cool overcast fill × baked **light volume** (sky visibility + neon bounce), plus a warm **key sun** masked by the baked **sun-shadow volume** (`textures/light_sun.png`). Rain/fog/snow dim the key. Glass reflects sky direction and nearby neon; wet streets get local neon highlights. Windows lit per instance (13% at night, 4% by day; warm, cool or TV-blue). Height haze integrates the camera-to-surface ray, separating dark near facades from distant haze. Palette and emissives follow the visitor's real clock. |
| Window borders | The mask encodes glass coverage in R and window ID in G, with walls storing zero in both. The shader recovers the original 8-bit ID from G/R before room selection, so filtering at window edges cannot invent brightly lit rooms. Linear coverage smooths borders; derivative-based minification blends tiny rooms toward their average light energy instead of hashing blended IDs. No new texture, draw or post pass. |
| Near-field light | `World/NeonLightRig.js`: nearby sign/lamp sources selected every 350 ms; bounded at 2/4/8 shader lights on Low/Medium/High–Ultra, shedding with bloom. Shared by the city, traffic, car and Neon materials. Compact moving underglow and subtle surface spill; **no visible car headlight cones**, even when forced on in the Neon debug settings. Analytic approximation, not ray tracing; no extra draws or shadow maps. |
| Sky / post | `World/NeonSky.js`: layered overcast clouds, weather-driven coverage, warm exposed tops, polluted night horizon. Reduced motion stops cloud scrolling. Far-plane depth test only shades visible sky. Existing bloom chain now soft-thresholds each sample before averaging (thin signs survive), with clock-dependent exposure/bloom and less hue clipping in the final tone map. No added render passes. |
| Traffic | `World/NeonTraffic.js`. Six vehicle types on the 4 lanes, positioned entirely in the vertex shader: 400 on Ultra, 140 on Medium. |
| Light beams | Instanced fog cones under ledges and lamps, nearest N by tier. |
| Hover car | Hover car GLBs replace the F1, with new physics dimensions. **`World/HoverFlight.js`**: T takes off or lands; W/S thrust, A/D yaw, E/Q climb/descend, Shift boost; gravity cancelled, velocity-tracking flight, 160 m ceiling (climb eases above 150), soft district walls. Pods fold to fan-down, thrusters glow, the body banks. You can't exit mid-air. Entry columns accept flying visitors; ordinary NPC/interior zones reject them. Project dialogs preserve flight, and career games restore arrival altitude/mode. On touch, ▲/▼ buttons sit above the existing touch column (beside it in landscape). |
| Camera / controls | `World/CameraRig.js`: chase camera behind the car (wider in flight), pulls in at towers. Walking keeps an independent view heading and retains the chosen orbit; strafing no longer turns the camera. `Controls.getViewYaw()` reads the rendered camera, replacing the old fixed angle for third-person walking and mobile drive/flight. W/S and A/D still thrust/steer the car; on foot they move forward/back and strafe. **C** toggles classic view, **V** first person, **F** enter/exit. |
| Cockpit | `World/CockpitDash.js`. The hover car's dashboard is a live canvas at about 15 Hz: speed (same number as the HUD), MODE DRIVE/FLIGHT, ALT, a live minimap (the HUD radar drawn into the dash) and the next project stop with a direction arrow. Camera attaches at the authored mesh-local 0.92 m eye (body +0.64 m), correcting the previous doubly lowered position. |
| Camera stability / audio | Final `Time.render` phase after world ticks; shared per-frame position/quaternion samples and cockpit-attached first-person eye. Ground entry contact no longer shakes; walking/skateboarding retain chase follow. Sixteen ElevenLabs futuristic clips, flight turbines/airflow and distinct transformations; no intro cue, skateboard samples unchanged. See `neon-district-audio-camera.md`. |
| Apartment | Supplied cyberpunk capsule interior and city-view texture are now wired. Dedicated atlas/AO cel-lit room independent of the outdoor sun, closed-door/furniture collision, three original stations, hidden when not occupied, indoor-only cyan control layout. |
| Project boards | `World/NeonProjects.js`: 18 Blender holo panels plus six facade screens with the existing real project artwork, requested order and original URLs. One bounded canvas atlas, two instanced screen draws, one merged frame draw and six compact floor labels. Old boards/fences/large ground text are hidden in Neon mode; interaction handlers remain. |
| Crowd / player | `World/NeonCrowd.js`: a single noncolliding VAT draw for tier-scaled ambient pedestrians plus six named conversational NPCs. `player.glb` uses one skeleton/mixer; `skateboard.glb` has four spinning wheel nodes. `SkateStance.js` pins complete boot soles to the deck and counter-rotates the head upright. Player-only emissive accents are green; the crowd atlas/material is not recoloured. |
| Aerial entry | `World/EntryBeacons.js`: 162 m rectangular shafts (matching 160 m flight) and ground apertures in two instanced draws, with frustum/distance filtering and no extra lights, shadows or colliders. Enter activates the column physically occupied in flight; E/Q remain altitude keys. A labelled DOM button supports touch. NPC talk zones and indoor stations stay ground-only. |
| Six career games | `World/MiniGames/*`: Packet Run, Beat Tunnel, Signal / Noise, Handoff, Containment and Ship It. Lazy GLB/spec/card/window resources, material-merged fixed scenery and instanced moving pieces. Tested game roots add fewer than 25 mesh draws. Isolated keyboard/held-touch input, blur pause, exactly-once results, preserved career costs/rewards and cleanup. Existing bowling/sprint stay separate. See `neon-district-minigames.md` for tuning and remaining polish. |

## Measurements (laptop, Intel UHD 620, Chrome on Linux; 1479 × 852 window)

- **Before the look pass's culling work:** 373 draws, 782k triangles in flight down Project Avenue, about 35 fps after the governor dropped to Medium at 0.6 resolution.
- **After global instancing with per-frame frustum packing and back-face culling:** about 257k triangles in the same flight.
- **Frame rate:** 27–48 fps across runs. The laptop is thermally noisy; the same scene varied by up to 15 fps between back-to-back runs.
- **Biggest single costs:** full-detail facade instances (hiding them gives 60 fps) and the full-screen sky. The sky now only shades visible pixels.

Do not infer phone performance from laptop GPU specifications. Run the physical-phone procedure below before calling the target met.

### Content-wiring measurement (2026-10-09)

Fresh Headless Chrome 154 on the actual Intel UHD 620/Mesa GPU, clear 13:00 preview, 412 × 915 viewport, site touch controls activated, 10 s warm-up and the existing 60 s scripted full-district route. No screenshot camera override or gameplay fixture remained active. Other desktop applications were running.

| Final tier / DPR | Average FPS | 1% low FPS | p95 frame time | Max draws | Max triangles |
|---|---|---|---|---|---|
| Medium / 0.90 | 59.29 | 29.45 | 16.9 ms | 122 | 143,082 |

The browser reports the legacy scene label `crossroads look slice`, but the full district, project gallery, VAT crowd and entry columns were loaded. This run is not controlled against the earlier lighting measurements, and it is not a physical Nothing Phone (3) result. Its average exceeds 35 FPS, but its slow-frame tail still falls below the sustained floor, so the 35 FPS acceptance gate is **not passed**.

### Lighting-pass measurement

Headless Chrome 154, actual Intel UHD 620/Mesa GPU (not software rendering), 412 × 915 desktop viewport with the site's touch controls activated, clear weather at 14:00. Existing 60 s scripted route. These are distinct run conditions, not controlled A/B performance comparisons:

| Condition | Final tier / DPR | Average FPS | 1% low FPS | p95 frame time | Max draws | Max triangles |
|---|---|---|---|---|---|---|
| After interaction/movement tests had altered the scene | Low / 0.50 | 28.17 | 3.75 | 50.0 ms | 184 | 120,595 |
| Fresh page, warmed for 10 s, before window-border fix | Medium / 0.70 | 55.85 | 17.78 | 27.1 ms | 187 | 129,066 |
| Fresh page, warmed for 10 s, with window-border fix | Low / 0.50 | 35.61 | 12.82 | 48.1 ms | 186 | 128,967 |

This is a desktop mobile-layout check, **not** Nothing Phone (3) emulation or device validation. Other desktop applications were running, and the governor/route caused substantial spikes. Earlier fixed-view readings varied from roughly 25 to 57 FPS; those short windows are not sustained benchmarks. The 35 FPS requirement remains open, including frame-time stability, not just average FPS.

To isolate the window change from that variability, a separate fixed-view check held Medium/DPR 0.75 and the same camera, geometry and lighting. Two alternating 6 s pairs measured **32.63 / 35.47 FPS with the fix** versus **33.30 / 35.36 FPS with the previous window shader**; all four had 191 draws and 121,990 triangles. No large window-fix regression was observed in this short check. This is not a phone acceptance test or a substitute for the warmed route benchmark.

## Phone procedure

1. `npm run dev -- --host 0.0.0.0 --port 4173`, then on the phone (same Wi-Fi) open `http://<laptop-LAN-IP>:4173/?perf=1&time=15:00&weather=clear`.
2. Enter, take off (Take off button), fly Project Avenue for 60 s, then run `?bench=1` five times back to back.
3. Record the GPU/UA line, final tier/DPR, average fps, 1% low and the fifth-run result.
4. Check clear daylight, night rain, driving, flight and walking. A 35 FPS average alone is not a sustained-floor pass; inspect the slow-frame tail and repeat after the phone has warmed up.

## Verification (all passing)

Visitor-play follow-up (2026-10-09): cockpit eye +28 cm to the authored mesh frame, 160 m free-flight ceiling, quieter velocity-driven wind and distance-fading city ambience, 300 starter credits with idempotent save migration, and all six no-cost practice entries. Packet Run adds one instanced portal draw plus three small sprite labels (hidden nearby to avoid phone-screen crowding), no real lights/shadows/passes; each game remains below 25 added draws. Collision-aware route planning runs on destination changes, not every collider every frame. New sprite materials/textures are disposed on exit.

Fresh 60-second standard route, 412 × 915 with touch activated, clear 13:00 daylight, 10-second warm-up, hardware-accelerated Intel UHD 620 / Headless Chrome 154: **59.60 FPS average**, **29.80 FPS 1% low**, **17.3 ms p95**, peak **121 draws / 173,703 triangles**, final **High / DPR 0.9** after the adaptive governor. No review fixtures or accelerated game steps were active during measurement. This is a laptop browser measurement, not physical phone evidence; the slow-frame tail still falls below the 35 FPS sustained target.

- `npm run test:assets` 5/5
- `npm run test:arcade` 4/4
- `npm run test:cyber-assets` 11/11
- `npm run test:quality` 10/10
- `npm run test:lighting-movement` 4/4 (four camera headings, diagonal normalization, touch mapping, bounded light budgets)
- `npm run test:minigames` 12/12
- `npm run test:entry-skate` 3/3 (vertical entry boundaries, ground-only exclusions, real Blender skin/animation: both soles inside the deck and upright head throughout the clip)
- `npm run test:camera-audio` 7/7; `npm run test:visitor-play` 3/3. All **59 Node checks** pass. `scripts/camera-interior.browser.js` 22/22 desktop and touch layout (0 cockpit-eye drift, 0 intro shake, no runtime/shader errors); `scripts/follow-input.browser.js` 10/10 live-frame walking/skating input checks. Mobile indoor actions clear the joystick; redundant car buttons hide indoors and navigation clears the room state.
- `scripts/visitor-play.browser.js` 31/31 desktop and touch layout: free-practice entry/replay, no charges or career rewards, loaded quiet audio, actual Cannon flight-input pickup/delivery, 160 m ceiling. The accelerated gameplay run delivered 90 packets with zero drops; it is not an FPS benchmark.
- `npm run build`
- In-page: `scripts/neon.browser.js` 30/30 (includes night headlight suppression, spill budgets/finite positions, storm-dimmed sun), `scripts/movement.browser.js` 16/16 desktop and 20/20 with touch activated (actual walking camera, stable strafe/orbit, ground steering and flight), `scripts/explorer.browser.js` 17/17 desktop and 18/18 touch, `scripts/career.browser.js` 44/44. No browser runtime errors during these checks.
- `scripts/window-borders.browser.js` 5/5: GPU fixture using the actual city shader, checking smooth coverage, no lit border on an unlit room, visible lit interiors, unchanged border hue/brightness and stable average energy for sub-pixel rooms.
- New wiring: `scripts/minigames.browser.js` 140/140 career-entry, reward and lifecycle checks; `scripts/minigames-play.browser.js` 28/28 rule/input progression checks without debug resolution; `scripts/minigames-mobile.browser.js` 21/21 at 412 × 915 with touch activated; `scripts/entry-skate.browser.js` 17/17 including green player-only lights, Enter vs climb, aerial button and flight restoration. After a fresh page, the browser error/shader-error collector remained empty. Screenshot review helpers must not remain active during regression or performance tests.
- Legacy `?neon=0` smoke check: six projects, 12 original pedestrians, resume link, no Neon game/entry controllers, and `scripts/career.browser.js` 44/44 after the arrival animation settled.

## Screenshots

`docs/screenshots/neon-district/`:
- `runtime-day-flight.jpg`
- `runtime-day-sky.jpg`
- `runtime-night-rain.jpg`
- `runtime-cockpit-night.jpg`
- `lighting-before-day.png`, `lighting-after-day.png`
- `lighting-before-night.png`, `lighting-after-night.png`
- `lighting-day-street.png`, `lighting-mobile-day.png`
- `windows-before.png`, `windows-after.png`, `windows-day-after.png`
- `wired-projects-day.png`, `wired-projects-night.png`, `wired-skater-green-day.png`, `wired-sky-entry.png`
- `wired-{signal-noise,handoff,containment,ship-it,packet-run,beat-tunnel}-day.png`
- `wired-signal-noise-mobile.png`, `wired-packet-run-mobile.png`
- `cockpit-raised-day.png`, `packet-dropoff-day.png`, `packet-dropoff-mobile-day.png`

`scripts/neon-lighting-review.browser.js` supplies matched lighting framing. `scripts/neon-content-review.browser.js` supplies fixed project/skater/aerial views and paused game review frames. These are review images, not sustained-FPS measurements or substitutes for interactive testing.

The `lighting-*` images document the initial lighting pass. The `windows-after.png` and `windows-day-after.png` images include the subsequent window-border correction.

## Known gaps

- **Lighting:** the sun direction is art-directed and fixed (afternoon, from the SSW); only its colour and strength follow the clock. No real-time shadows from moving cars.
- **Light spill:** nearby lights use radius/facing falloff rather than dynamic occluder shadows. Baked canyon lighting remains the main occlusion source.
- **Performance:** physical Nothing Phone (3) testing is still required; the laptop benchmark above misses the 35 FPS target.
- **Game polish:** core wiring/play/rewards are complete, but the original design still has optional presentation/bonus features listed in `neon-district-minigames.md`'s runtime notes.
- **Draw calls:** full-city views can still exceed the overall 150-draw target. The city itself is about 70 module/material/LOD groups; game roots, gallery, crowd and entry columns are bounded/batched. The physical-phone route gate remains open.
