# Neon District: Cyberpunk Overhaul Build Plan

Status: **assets built; look pass and content wiring implemented** (full district, lighting, flight, cameras, live cockpit, project holo gallery, VAT crowd and six career games). Updated 2026-10-09. See [`neon-district-perf.md`](neon-district-perf.md) for current verification and remaining physical-phone/performance acceptance, and [`neon-district-minigames.md`](neon-district-minigames.md) for game-specific tuning and follow-up polish.

**Latest user changes:** the first-person cockpit eye uses the asset's mesh frame (0.92 m), fixing the previous 28 cm low position. Free flight now reaches 160 m, easing above 150 m; sky-entry columns reach 162 m. Very subtle hover wind and distance-fading city ambience reuse the ElevenLabs pack. Players receive 300 starter credits (one-time +300 migration for old saves), and all six games have no-cost practice in After Hours Arcade. Packet Run has labelled delivery rings, collision-aware roof-clearance waypoints, on-arrival request queues and a 180-second round. Signal / Noise allows more reading time; Ship It has next-station guidance and grounded feet. Green player accents, upright skating, Enter/touch aerial entry and arrival-mode restoration remain unchanged.

**Already done:** every 3D asset, texture and the full district layout are built and checked. They live in `static/models/cyber/`, are described in **[`neon-district-assets.md`](neon-district-assets.md)**, and are checked by `npm run test:cyber-assets`. Reference renders are in `docs/screenshots/neon-district/`. The building agent's job is now the runtime: materials, cameras, flight, the content port and performance.

**Runtime review:** [eight daylight/night/weather screenshots](screenshots/neon-district/runtime-review.png). The shaders use the original Blender kit, baked AO, decoded light volume, atlas signs, depth/height fog and tiered bloom. Existing walking, arcade and career browser regressions pass. The target phone was confirmed as **Nothing Phone (3)**; no physical-device measurement has been made. Do not advance past the visual gate or claim the phone's 35 FPS floor is verified.

This is the build spec for turning the portfolio's bright Manhattan city into a dense, foggy, neon cyberpunk district. The reference is the Megacity look in `cyberpunk inspo vids/`. The car becomes a hover car that can drive and fly. All existing portfolio content stays: projects, information, mini games, career RPG, interiors and NPCs. It is all restyled.

The plan is written so another agent can build it phase by phase without re-deriving context. It contains no code on purpose. It describes what to build, where it goes, the numbers to hit, and how to prove each phase works.

---

## 0. Rules for the building agent

1. **Work phase by phase (section 16).** Each phase ends with a gate. Phases 1 and 7 need the user's approval before continuing.
2. **Keep the world's coordinate layout.** These all depend on today's x/y positions: career doors (`careerData.js`), section origins (`World/index.js`), pedestrian routes (`Pedestrians.js`), arcade gates (`Arcade.js`), the minimap and the guided tour. Restyle in place. Build upward (z), not sideways. If something must move, update every consumer in the same change.
3. **Licensing.** Do not use or recreate Unity Megacity assets. Unity's license limits them to the Unity engine, which is why mrdoob's port has no public link. Do not read, copy or derive from the source of `sael.net/gigacity`; it is all-rights-reserved. Both are mood references only. Every asset must be:
   - original, made in Blender by script or through the Blender MCP, or
   - CC0 (Poly Haven, Kenney, Quaternius), with its source recorded in `docs/asset-credits.md`.
4. **Performance is a feature with a hard floor: at least 35 fps sustained on the target phone** (section 15). A visual feature that breaks the floor ships behind a quality tier or doesn't ship.
5. **Keep tests green after every phase:** `npm run test:assets`, `npm run test:arcade`, `npm run build`, and the browser scripts in `scripts/*.browser.js`. Extend them as described in section 17.
6. **Accessibility and the recruiter fast path come first.** The DOM recruiter brief (`RecruiterBrief.js`, `.city-welcome`, `.js-brief-open`, `.js-resume`) must keep working without WebGL and must not be blocked by the new visuals. Honor `prefers-reduced-motion`.
7. **Commit per logical step** with clear messages. Never commit `cyberpunk inspo vids/`; it's 30 MB of reference video. Add it to `.gitignore`.
8. **Use the built assets; don't re-model.**
   - Load `static/models/cyber/*` per `docs/neon-district-assets.md`.
   - If an asset needs changing, edit the step scripts in `scripts/neon-district/`, rebuild in Blender (the MCP add-on is installed) and re-run `npm run test:cyber-assets`.
   - **Never use AI 3D generators that cost credits** (Blender MCP `generate_3d`, Hyper3D, Tripo, Hunyuan cloud). The user has ruled this out. CC0 Poly Haven imports are allowed.

---

## 1. Goals and non-goals

**Goals**
- An immersive, small, explorable cyberpunk district with deep vertical streets, layered fog, neon signs, flying traffic and rain-slick streets.
- The hero vehicle drives on the ground and flies through the street canyons. The player can get out, walk, skate and go first person.
- All portfolio content survives, restyled: 6 projects, information/contact, Midnight Sprint, Neon Bowling, Career RPG, apartment interior, NPCs, guided tour, project cinematic, easter eggs, weather, sounds.
- The day/night cycle stays tied to the visitor's real local time.
- At least 35 fps sustained on phones and integrated-GPU laptops, and at least 60 fps on discrete-GPU desktops.

**Non-goals**
- Recreating Megacity's fidelity (17M triangles, 75 MB). The target is the same mood at about 2% of the cost.
- An endless or procedural infinite city. The district is bounded.
- Real ray tracing, real volumetric lighting, real-time reflections or real-time shadow maps.
- WebGPU as a requirement. WebGL2 is the baseline (section 9.1).
- Multiplayer, backend services and leaderboards. Leaderboards stay local, as today.

---

## 2. Locked user decisions

| # | Decision | Implication |
|---|---|---|
| 1 | Day/night follows the visitor's actual local time, as now | Keep `DayNightCycle.update()` reading `new Date()` (`DayNightCycle.js:368`). Only the palettes and lighting response change (section 7.2). |
| 2 | Camera is a **mix**: a chase camera in the city, framed "showcase" cameras at portfolio spots, and **first person kept** (V key / button) | Section 12 |
| 3 | Info, mini games, projects, buildings and NPCs **all stay**, restyled | Section 14 has a per-feature port table |
| 4 | Target phone: **Nothing Phone (3)**, confirmed by user | Primary target is at least 35 FPS sustained. Phone results remain pending; desktop rendering and mobile viewport emulation are not substitutes. |

---

## 3. Look bible (from the reference video)

I pulled frames from the reference (`cyberpunk inspo vids/5bz2Q_h1I7Uq9NIw.mp4`, 720×720, 60 fps, 4:53). Its HUD reads "MEGACITY, Unity's GDC 2019 demo in three.js" on WebGPU at 28–60 fps, 300–600 draws and 2–17M triangles.

**Composition**
- Deep **vertical street canyons**. Towers rise far above the camera. Looking up shows a bright, narrow slit of overcast sky; looking down shows dark, hazy depth.
- Towers are **heavily greebled**: balconies, window bays, AC units, pipes, cables, scaffolding, hanging signs, catwalks and skybridges between towers.
- **Chase camera** slightly above and behind the hover car, with the car in the lower-middle third of the frame.

**Light and atmosphere**
- The scene is **light at the top and dark at the bottom**. The sky is bright grey-white overcast; the lower canyon is near black with teal-grey haze.
- **Thick depth and height fog** in desaturated grey-teal. Silhouettes 60 m or more away dissolve into flat fog shapes.
- **Light beams**: cone-shaped shafts pointing down from spotlights under ledges and from hovering vehicles. They're soft and cool white.
- **Neon accents are small and scattered**: magenta, cyan, acid green and warm amber panels, plus a few large billboards (one with CJK characters). Neon is the only saturated color in the scene.
- **Glow (bloom)** on emissives only, with a moderate radius.

**Hero vehicle**
- A boxy, rounded **red** hover car.
- **Twin horizontal red light bars** on the rear, bright and blooming.
- **Blue-white thrusters** underneath, with a cool glow on surfaces below.

**Traffic**
- Hundreds of small vehicles in **layered flight lanes** at different altitudes, in dark silhouettes with tiny lights.

**HUD**
- Minimal **monospace** text: a small square logo and title top-left, a pill-shaped status badge and a collapsible panel top-right, and a stats line bottom-left.
- Thin borders on translucent dark panels. No heavy chrome.

**Translating this to the portfolio's identity**
- Keep the project accent colors from `projectCatalog.js` as each project's neon color.
- Keep JetBrains Mono, already a dependency, for all HUD text.
- Archivo Black stays for big display moments only, such as the intro title and project names on billboards.

---

## 4. Licensing and attribution

- Megacity assets: **forbidden**.
- Gigacity code: **forbidden**. Never fetch or inspect its source.
- Poly Haven, Kenney and Quaternius CC0 assets are allowed. Log each one in `docs/asset-credits.md` with its URL and license.
- Blender MCP `generate_3d` output: allowed for one-off props only. It costs the user credits, so ask first. Generated models must be decimated to budget and re-textured into the shared atlas.
- Fonts: the existing `@fontsource` packages (OFL). CJK glyphs on signs are **baked into textures in Blender or a canvas step**, so no CJK web font is shipped. Use a font with a license that allows embedding, such as Noto Sans CJK (OFL). Keep text decorative and short, and never use real brands.

---

## 5. Current architecture: what exists and what happens to it

Stack: Vite 5, three **0.164.1**, cannon 0.6.2, gsap, howler, custom GLSL in `src/shaders/`. **The world is Z-up** (gravity −Z). One unit is about one meter; the car chassis is about 2 units long. The world spans roughly x −60…150 and y −65…12.

| File / system | Today | Plan |
|---|---|---|
| `Application.js` | Renderer (WebGL, `alpha: true`), EffectComposer with a half-float MSAA target, blur passes (disabled), `ScreenFx` (glow + vignette + ground mist), adaptive DPR and MSAA drop (`:393`) | Keep the structure. Replace the post chain (section 9.6). Replace the adaptive DPR logic with the Quality Governor (section 15.3). |
| `Camera.js` | Fixed angled follow camera (`angle.items.default/projects`), zoom, pan, shake, FOV kick, orbit (debug) | Add a camera **rig state machine**: chase, showcase, first person, on-foot follow, game (section 12). Reuse the angled cameras as "showcase". |
| `World/Materials.js` + `shaders/matcap` | Matcap cel shading; `getCelMaterial(color, emission)` used everywhere | Add a **CyberMaterial** family (section 9.2). Keep `getCelMaterial`'s signature but have it return the new material, so callers keep working. Retire matcaps after the content port. |
| `World/City.js` + `static/models/nyc/manhattan.glb` | 36 towers, roads, trees, signs; one box body per block; merged fake shadows; ground reflection quad | Replace with `NeonCity` (section 8), which **loads `district-layout.json` + `city-kit.glb`**: 55 towers (the 36 original footprints made taller + 19 new infill towers), skybridges, pads, signs, beams, lanes, skyline ring. Keep the road and sidewalk meshes from `manhattan.glb`, or re-skin them, until a road asset exists. |
| `World/Physics.js` | cannon world, fixed step 1/60, `RaycastVehicle` car (`:237`), `car.speed`, `car.angle` | Add a **flight mode** to the same chassis body (section 11). `car.speed` and `car.angle` must stay correct in every mode because many systems read them. |
| `World/Car.js` | F1 GLB parts: chassis, wheel, brake, reverse, antenna | Point the resource keys at `static/models/cyber/hover-*.glb` (built). Add `carDefaultThrusters`. Compose the drive↔fly pod fold from `hover-car.json` (section 11.0). Bind the cockpit screens (section 11.5). |
| `World/Explorer.js` | Exit/enter car (F), first person (V), skateboard (Shift), walker body, `updateCamera()` | Keep. Change the exit check from `z > 2` to "grounded on a walkable surface". Add rooftop pads (section 13.2). Hand camera control to the new rig. |
| `World/Pedestrians.js`, `CareerNPCs.js` | Box-people, instanced per material, route list | Replace the box rig with the cyber character mesh, animated with vertex animation textures (section 13.3). Keep routes and add more. |
| `World/DayNightCycle.js`, `Sky.js`, `AdvancedLighting.js`, `Weather.js`, `Fireflies.js` | Real-time cycle, seasons, sky dome with sun, moon, stars and clouds; headlight cones; rain, snow, fog | Keep the logic and replace the palettes (section 7.2). Sky becomes overcast with a light-to-dark gradient. Fireflies become drifting neon dust and ash. Rain is the default mood. |
| `World/Sections/*` | Intro, crossroads, projects (6 boards), information, playground | Restyle (section 14). Project boards become holo billboards. |
| `Arcade.js`, `CareerRPG.js`, `Interiors.js`, `GuidedTour.js`, `ExperienceDirector.js`, `Minimap.js`, `ExperienceHUD.js`, `EasterEggs.js` | As documented in `docs/after-hours-arcade.md` and `docs/manhattan-circuit.md` | Restyle and make flight-aware (section 14) |
| `Sounds.js`, `AmbientSounds.js`, `scripts/generate-sounds.mjs` | Engine, cues, synthesized ambience (rain, wind, crickets, birds) | Add hover and thruster audio. Ambience becomes city hum, distant sirens and rain on metal (section 14.12). |
| `scripts/build-city-assets.py`, `assets/blender/manhattan-circuit.blend` | Isolated-scene Blender build to GLB, Z-up, export selected | Same pattern in the new `scripts/build-cyber-assets.py` and `assets/blender/neon-district.blend` (section 10) |

---

## 6. Player-facing spec

### 6.1 Modes

| Mode | How you enter it | Camera | Notes |
|---|---|---|---|
| **Drive** | Default after start; landing | Chase (city) or showcase (portfolio zones) | Same handling feel as today |
| **Hover / Fly** | "Take off" (**T**, or touch button) while driving | Flight chase | Wheels fold into hover pods. Auto-levels. Altitude limits apply. |
| **On foot** | F / "Exit" when grounded and slow, on the street or a rooftop pad | On-foot follow or showcase | Walk; Shift toggles the skateboard |
| **First person** | V, in any of the above | Cockpit or eye level | Drag or pointer-lock to look (existing) |
| **Game** | Arcade start pads | Arcade cameras (existing) | Forces Drive mode; takeoff disabled |
| **Interior** | Career doors | Interior camera (existing) | Unchanged flow, restyled room |

### 6.2 Desktop controls

| Action | Keys |
|---|---|
| Throttle / reverse / steer | WASD or arrow keys (existing) |
| Boost | Shift while driving or flying (existing) |
| Brake / hover-hold | Ctrl or Space (existing brake) |
| Take off / land | **T** (Space is already brake in `Controls.js:79`, and Space is used by `CareerGames.js` and `Arcade.js`) |
| Climb / descend (flying) | **E / Q** |
| Exit or enter car | F |
| First person | V |
| Camera style (Chase ↔ Classic) | **C**, persisted in localStorage |
| Mute / tour / etc. | Unchanged |

### 6.3 Touch controls (phones and tablets)

- **Left:** the existing analog joystick (`Controls.js`) for throttle and steering.
- **Right cluster:** large buttons at least 56×56 CSS px, in the bottom-right thumb arc.
  - Driving: **Boost**, **Brake**, **Take off**.
  - Flying: **Up** and **Down**, held for climb and descend, plus **Boost** and **Land**.
  - On foot: **Skate**, **Get in** (when within 4 units of the car), **Interact** (when in a zone).
- **Top-right:** first person and camera style toggles, alongside the existing explorer panel.
- In first person on touch, drag anywhere outside the controls to look (existing).
- Respect safe-area insets. No control may cover the minimap or the brief/resume links.

### 6.4 Flight envelope (player-facing)

- Flying is allowed inside the same district boundary, from **1.5 units above the surface to 160 units absolute height**. The new ceiling clears the tallest 112 m tower. Runtime `flightRules.js` overrides the original authored 70/62 m envelope without expanding the horizontal city bounds.
- Climb speed eases above 150 m toward a 160 m ceiling; hovering below the ceiling does not force descent. Descend remains available.
- At the boundary there's a soft wall: the fog thickens, the car is steered back, and a "Restricted airspace" hint shows.
- Hitting a building bumps the car and plays a hit sound (existing car-hit sounds). The car doesn't crash or explode.

---

## 7. Art direction details

### 7.1 Palette (sRGB targets; tune at the Phase 1 gate)

| Token | Value | Use |
|---|---|---|
| `fog.day` | `#8d9a9f` | Daytime haze, grey-teal |
| `fog.night` | `#1a1f2b` | Night haze; picks up a magenta tint near neon |
| `sky.dayTop` / `sky.dayHorizon` | `#d8dee2` / `#9aa6ab` | Overcast |
| `sky.nightTop` / `sky.nightHorizon` | `#05070c` / `#2a1830` | Light-polluted night |
| `facade.base` | `#3a3f45` → `#1b1e22` by height | Concrete and metal, never pure black |
| `neon.magenta` | `#ff2bd6` | Signs |
| `neon.cyan` | `#22e5ff` | Signs, UI accent |
| `neon.acid` | `#9dff3a` | Signs (sparingly) |
| `neon.amber` | `#ffb02e` | Windows, street lamps |
| `hero.red` | `#e0141e` body, `#ff2a2a` light bars | Car |
| `thruster.blue` | `#58b6ff` | Thrusters, hover glow |
| Project accents | from `projectCatalog.js` | Each project's billboard neon |

### 7.2 Day/night (real local time, existing timeline)

Keep `DayNightCycle`'s timeline, seasons, transitions and weather influence. Replace only the color schemes in `prepareColorSchemes()` and add these outputs as uniforms shared by every CyberMaterial:

| Output | Night | Dawn | Day | Dusk |
|---|---|---|---|---|
| `uNight` (0–1) | 1 | 0.6 → 0 | 0 | 0 → 0.8 |
| Fog color / density | night, 1.0 | blend, 0.9 | day, 0.75 | blend, 0.9 |
| Neon intensity | 1.0 | 0.6 | **0.35** (still visible, like the reference daylight) | 0.8 |
| Lit-window fraction | 55% | 25% | 8% | 40% |
| Sky | dark with light-pollution glow at the horizon | pale rose-grey | bright overcast | orange-magenta band |
| Light-beam opacity | 0.5 | 0.3 | 0.15 | 0.35 |
| Rain probability bias | +20% | – | – | +10% |

Sun and moon discs become barely visible through the overcast (opacity 0.15–0.3). Stars appear only in gaps on clear nights.

### 7.3 Signage

- 40–80 neon signs across the district from a **sign atlas** of about 24 designs: vertical CJK strips, horizontal katakana, pictograms (noodles, pharmacy, cyber-implants, capsule hotel), arrows, ring logos and shop-front frames.
- A few **hero billboards**:
  - One per project, in its accent color, on Project Avenue. These replace the floor boards as the visual draw; the boards stay as the interaction zone (section 14.2).
  - One large rooftop "RICHARD SIMMONS / AI ENGINEER" sign near the intro.
- Signs flicker subtly (per-instance random phase). There is **no flicker under reduced motion**.
- Existing green NYC street signs (`City.addSign`) become cyan wayfinding signs in the same positions with the same text.

---

## 8. World layout: NeonCity

### 8.1 Footprint

Keep today's play area, about x −60…150 and y −65…12. Boundary: x −75…165 and y −80…25 for flying; the ground is already bounded by buildings and walls. Outside the boundary, a non-collidable **skyline ring** of tall silhouette towers (120–220 units) fades into fog so the city feels endless.

### 8.2 Vertical layers

| Layer | z range | Contents | Collision |
|---|---|---|---|
| Street | 0–6 | Roads, sidewalks, storefronts, kiosks, steam vents, puddles, career doors, project zones | Existing bodies |
| Low canyon | 6–25 | Balconies, AC units, hanging signs, fire escapes, cables | None (decoration). It must stay outside the drive lanes, so keep it more than 1 unit from facades over roads. |
| Mid canyon | 25–55 | **Skybridges** (6–10), catwalks, light-beam spotlights, big signs, rooftop pads on lower towers | Box bodies for skybridges and pads only |
| Upper | 55–120 | Tower crowns, antennas, billboards, water tanks, traffic lanes | Tower box bodies extend to full height |
| Skyline ring | out of bounds | Silhouette towers | None |

### 8.3 Towers

- Reuse the **36 building footprints** from `manhattan.glb` (`block_N` naming), so collision boxes and career doors stay aligned.
- **Built and baked:** every tower is already assembled from kit modules in `district-layout.json` (`instances`, `towers`). **Don't write a tower generator.**
  - 36 `existing` towers on the original footprints, 20–88 m tall. The tallest wall is the north side of Project Avenue.
  - 19 `infill` towers, 52–112 m: a south wall at y ≤ −46 for x 32–160, a north band at y ≥ −3 behind the avenue towers, and east and west end caps.
  - Together they form a 28 m-wide canyon along Project Avenue.
  - Infill footprints were checked against the sprint gates, the y = −38 NPC route, trees, the arcade and the information area.
- Keep the street-level facade bands where career doors sit (`careerData.js` door coordinates). Each door gets a neon door frame and a sign.
- **Collision:** one box per tower, full height, as today. Setbacks don't need separate bodies; the car bumps the base box's footprint all the way up, which is acceptable. Skybridges and pads get their own boxes.

### 8.4 Landmarks mapped to existing content

| Existing location | Coordinates (x, y) | New landmark |
|---|---|---|
| Intro / spawn | 0, 0 | A plaza under a giant rooftop name sign; light beams; spawn on a glowing launch pad |
| Crossroads | 0, −30 | A four-way canyon junction with holographic wayfinding sign columns; Phase 1 slice location |
| Project Avenue | x 30…150, y −23…−40 | "Neon Row": 6 hero billboards in project accent colors, holo kiosks at each board |
| Information | 1.2, −55 | A "Comms Tower" base with contact link landmarks (`link-*.glb`) restyled as neon terminals |
| Arcade courtyard | per `Arcade.js` | "After Hours" back alley: neon lane paint, shutter doors, fire escape, vending machines |
| Career doors | `careerData.js` | Neon door frames; employer names in signs |
| Apartment | per `createApartment.js` | Capsule-hotel facade; interior restyled (section 14.6) |
| Rooftop pads | built: `crossroads` (−18, −6.35, deck 24.5), `information` (39, −53, 28.5), `avenue` (85, −53, 32.5), `intro` (31, 4, 24.5) | Lift points (`pad`/`street`) are in `layout.pads` |
| Hero billboards | built: one per project, each within 3 m of its board's x, z 9 on north towers; name sign on block 02's roof | `layout.heroBillboards` (screen slot `nd_screen`) |

### 8.5 Street dressing (instanced)

- Street lamps with light cones.
- Steam vents with a cheap animated sprite.
- Vending machines (emissive), bollards, parked hover cars, cables overhead, puddle decals.
- The 17 `TREE_POSITIONS` colliders in `City.js` stay as colliders and are re-skinned as **holo kiosks and planters with purple neon ginkgo trees**.

### 8.6 Flying traffic

- Four lane loops (built, `layout.lanes`) at altitudes 38, 52, 64 and 86 (the last is above the flight ceiling), following the street grid. They clear the skybridges (z 18–34). Vehicles: `traffic.glb` has six types: cab, van, pod, double-deck bus, police cruiser with light bar, cargo hauler (mix in the assets doc, section 5).
- Vehicles are **visual only, with no collision**, like pedestrians today.
- **GPU-animated:** an instanced mesh of 3 vehicle variants. Each instance has a lane, offset and speed, and the vertex shader computes position along a lane texture, so the CPU cost is zero.
- Counts are set by tier (section 15.2): 60 to 400.
- Each vehicle has tiny head and tail emissive lights. At night, the lanes read as light streams.
- A near-miss whoosh sound plays when the player flies within 6 units of a lane at speed. This is computed analytically from lane geometry, not per vehicle.

---

## 9. Rendering architecture

### 9.1 Renderer choice

- **Stay on `WebGLRenderer` (WebGL2).** It's universal on phones. Nothing here needs WebGPU.
- **Optional, Phase 0:** upgrade three from 0.164 to the current release in its own commit, for `BatchedMesh`, KTX2 and color-management improvements. Run all tests and a visual check. If it causes regressions, stay on 0.164; everything in this plan works there.
- Keep `alpha: true` only if `ScreenFx` still composites the sky through alpha. With an opaque sky dome, switch to `alpha: false`, which is slightly cheaper.

### 9.2 CyberMaterial (one shader family, replaces matcap cel)

A custom `ShaderMaterial` in `src/shaders/cyber/`, built by a factory in `World/Materials.js`. Variants are shader defines, not separate shaders:

- **Base color** from the shared **atlas** (UVs per module) multiplied by an optional per-instance tint.
- **Baked AO/light** from **vertex colors** (baked in Blender per module) multiplied by a **height-darkening gradient**: darker near the street and brighter toward the top. This gives the light-top, dark-bottom look for free.
- **Light volume (built; the main lighting trick, section 9.10):** sample `light-volume.json` / `light_volume.png` by world position for **sky visibility** (canyon darkening) and **coloured neon bounce**. It replaces the height gradient when present, and works per pixel with instancing.
- **Emissive mask** from an atlas channel × `uNeonIntensity` × per-instance flicker. Writes into the bloom input (section 9.6).
- **Lit windows:** windows are emissive-mask regions. A per-instance hash compared with `uLitFraction` decides which are lit, with a warm/cool color choice. There's a slow on/off drift unless reduced motion is on.
- **Neon spill:** up to N fake point lights (a uniform array; N by tier, from 4 to 16). These are the neon signs nearest the camera, chosen on the CPU every 0.5 s. They add colored light to facades with cheap distance falloff and no shadows. This is what puts magenta and cyan on the walls.
- **Hero lights:** car thrusters (blue, below the car) and headlights (existing headlight cones in `AdvancedLighting`) as 2 more analytic lights.
- **Fog in the material:** exponential distance fog plus height fog (denser below z≈8) using the `DayNightCycle` palette. Computing fog per material instead of in post works with transparent objects and saves a depth read.
- **Wet ground variant:** for roads, darkens and adds a fake reflection of neon spill and a screen-space-free sheen. Extend the existing analytic reflection quad idea; its strength scales with weather wetness.
- **Reveal:** keep the uniform hooks the world reveal animation (`World/index.js` matcapsProgress) uses, so the intro reveal still works.
- `getCelMaterial(color, emission)` keeps its signature and returns a CyberMaterial with a flat color and no atlas, so every existing caller works before it is properly restyled.

### 9.3 Fake volumetric light beams

- Cone meshes (open-ended, 12–16 segments) with additive blending and no depth write.
- Fragment intensity uses a radial falloff from the cone axis times a length falloff, a soft fade near the camera, and a fade where it meets surfaces (approximated with a length cutoff, no depth texture).
- Instanced: one draw for all beams. Count by tier: 12 to 48.
- Sources: under-ledge spotlights, street lamps, the hero car's under-glow (a short cone below the car while flying), and parked hover vehicles.

### 9.4 Sky

- Replace the `Sky.js` disc approach with an **inverted sphere** and a gradient shader driven by the palette, plus a scrolling cloud texture (the existing `cloudTexture()` canvas can seed it), plus a horizon glow at night.
- The sky is drawn first, with no depth write.
- At night, add sparse blinking aircraft lights on the skyline ring.

### 9.5 Weather (existing `Weather.js`)

- **Rain:** keep the line segments and splash rings, recolored cool-white. Add neon-tinted splashes near signs (use the spill colors). Raise the base rain probability. Rain wets the road material.
- **Snow:** keep.
- **Fog weather:** raises fog density and lowers neon spill range.
- **New: "smog"** state in daytime: denser warm-grey fog.
- Arcade rounds still force clear weather, as today.

### 9.6 Post-processing chain (replaces blur + ScreenFx)

1. **Scene render** into a half-float target. MSAA by tier (4, 2 or 0).
2. **Bloom.** Bloom input is pixels above a luminance threshold; emissive materials output over 1.0 in HDR, so they're the only ones that pass. Use a **dual-filter (Kawase-style) mip-chain bloom**, cheaper than `UnrealBloomPass`:
   - Start at ½ resolution on Ultra/High and ¼ on Medium, with 3–5 mips by tier.
   - Low tier: no bloom. Signs instead carry pre-baked glow halos (additive quads baked into the sign atlas).
3. **Final composite (one pass), extending `ScreenFx`:**
   - bloom add
   - tone map (ACES-fit or AgX-lite)
   - color grade: lifted blacks, teal shadows, warm highlights
   - vignette (existing)
   - subtle film grain (desktop tiers)
   - chromatic aberration at the edges (Ultra only, off under reduced motion)
   - sRGB output conversion, once, as today
4. Remove the two blur passes. They're already disabled; delete them and their touch toggling in `Application.setConfig`.

### 9.7 Draw-call strategy

- **City modules:** one `InstancedMesh` per module type × material, or one `BatchedMesh` per material if three is upgraded. The goal is **under 40 draws for the whole city**.
- Per-block frustum culling: split instances into **spatial cells** (for example 30×30 units). Each cell is a separate instanced mesh with correct bounds so off-screen cells are culled.
- **Skyline ring:** one merged mesh plus one impostor-billboard instanced mesh.
- **Signs:** one instanced quad mesh using the sign atlas, with per-instance UV rect and color.
- **Traffic:** 3 draws. **Pedestrians:** 1–3 draws. **Beams:** 1 draw.

### 9.8 LOD and draw distance

- Camera far plane set by tier (fog completely hides the cutoff): 220, 180, 140 or 100.
- Modules have 2 LODs: full greebles below 50 units and a simple box with an atlas texture beyond. LOD swaps happen per cell, not per instance.
- Greeble-only modules (AC units, pipes) are dropped entirely beyond 70 units.

### 9.9 Textures

- **Built:** a **1024²** kit atlas, split into `kit_color.png` (sRGB) and `kit_mask.png` (R window glass, G window id, B emissive), plus a **1024²** sign atlas (`signs_color.png` + `signs_halo.png`), all PNG at about 1.1 MB.
- KTX2 (ETC1S via `KTX2Loader`, transcoder in `static/basis/`) is an **optional** later step. No `toktx`/`basisu` is installed on the dev machine. Converting `signs_color.png` (825 KB) would give the biggest saving.
- Canvas-generated textures (labels, project text) stay as canvas textures but are capped at 1024 px wide.
- Target total GPU texture memory: under **150 MB** on phones (Medium/Low).

### 9.10 Light volume: getting the reference video's lighting (built)

The reference's look comes from baked global illumination in deep street canyons, plus volumetric fog, HDR and bloom. A phone can't compute that live, so it's **baked**.

**What's built:** a 3D grid (111 × 48 × 33 cells, 3/3/4 m) over the district stores sky visibility (A) and neon bounce (RGB) from 1,284 light sources, occluded by towers and skybridges, in a 135 KB PNG slice atlas.

**In the CyberMaterial:**
- Shade with `lit = albedo · ao · (skyColour · mix(0.08, 1, sky) + bounce · neonIntensity) + emissive`.
- `skyColour` and `neonIntensity` follow the day/night palette (section 7.2).
- Preview values: night sky (0.06, 0.07, 0.11) with neon 3.0; day sky (1.1, 1.17, 1.22) with neon 0.6.

**Use it on everything:**
- Sample per fragment on the city kit.
- Sample once per object (at its position) for the car, characters, traffic and props.
- Tint the height fog with the bounce colour, so haze near signs glows.

**Cost:** two texture samples per fragment. It runs on every quality tier, including Low.

**Before/after:** `docs/screenshots/neon-district/lighting-night-before-after.jpg` and `lighting-day-before-after.jpg`, rendered in Blender with the same maths.

**Rebuild:** run `scripts/neon-district/11_light_volume.py` whenever `district-layout.json` changes.

**Priority order for the look:**
1. Light volume
2. Fog + tone mapping
3. Bloom
4. Light beams
5. Reflections

The first two carry most of it. What we won't match: live shadows from moving cars, and ray-marched volumetric fog. Neither runs at 35 fps on a phone.

---

## 10. Assets (BUILT 2026-10-08)

Full detail: **[`neon-district-assets.md`](neon-district-assets.md)**. Summary:

| Asset | File(s) | Size / tris | Key facts |
|---|---|---|---|
| City kit | `city-kit.glb`, `city-kit.json` | 560 KB / 5,806 total | 36 modules, `kit_<m>_lod0/1`, anchors `anchor_beam/sign/door/lift/steam/light/spawn` |
| District | `district-layout.json` | 387 KB | 8,779 baked placements, 55 towers + collision, 5 skybridges, 4 pads, 7 hero billboards, 396 sign slots, 495 beam anchors, 12 door anchors, 4 traffic lanes, flight bounds |
| Hero car (drive + fly) | `hover-chassis/-wheel/-brake/-reverse/-antenna/-thrusters.glb`, `hover-car-assembled.glb`, `hover-car.json` | about 130 KB of parts / 1,388 tris | Pods are real wheels in DRIVE and fold fan-down in FLY. Clips `drive_to_fly`/`fly_to_drive`. Physics option values and cockpit spec in the JSON. |
| Traffic | `traffic.glb` | 94 KB / 1,032 | cab, van, pod, bus, police (light bar), cargo hauler |
| Player | `player.glb` | 135 KB / 534 | 15-bone skin; idle, walk, run, skate, wave, enter_car |
| NPC crowd | `npc.glb`, `npc-vat.json`, `textures/npc_vat.png` | 38 KB + 57 KB / 376 | VAT: idle, walk, talk; 6 colour variants via the atlas variant block |
| Boards | `skateboard.glb` (default, 4 spinning wheel nodes), `hoverboard.glb` (cosmetic) | 17 KB / 9 KB | Long axis +Y, 0.44 × 1.35 footprint like the old board |
| Signs | `signs-atlas.json`, `textures/signs_*.png` | 29 designs | Invented shop names, CJK baked in, includes the RICHARD SIMMONS / AI ENGINEER name sign |
| Dashboard mock | `textures/dash_mock.png` | 1024 × 176 | Design target for the live dash canvas |
| Light volume | `light-volume.json`, `textures/light_volume.png` | 135 KB | Sky visibility + neon bounce grid (section 9.10) |
| Apartment interior | `apartment-interior.glb`, `textures/apartment_window.jpg` | 131 KB / 1,472 | Capsule apartment on the existing room frame and stations (section 14.6) |
| Career mini-games | `minigames.glb`, `minigames.json`, `minigame-atlas.json`, `textures/minigame_atlas.png` | 516 KB / 5,606 + 917 KB atlas (lazy) | Six 3D games (section 14.16, `docs/neon-district-minigames.md`) |
| Source | `assets/blender/neon-district.blend`, `scripts/neon-district/01…16_*.py`, `manhattan-blocks.json` | | Rebuild steps in the assets doc, section 13 |

### 10.6 Budgets (enforced by `npm run test:cyber-assets`)

Per-file byte and triangle budgets live in `scripts/cyber-assets.test.mjs`. **All Neon District files together are 2.75 MB** (test limit 4 MB), against the plan's original 8 MB allowance. A street-level view at full detail is well inside 400k visible triangles once per-cell culling and LOD1 beyond 50 m are in place. The whole district at LOD0 would be about 966k.

Initial load must stay **≤ 10 MB**. Interiors, arcade assets and cinematic images load lazily, as `loadDeferredContent()` already does.

---

## 11. Vehicle spec: drive and fly

### 11.0 Visual transformation (built)

The car has a **normal, non-hovering drive mode** and transforms back and forth:
- **DRIVE:** pods are wheels; `nd_thruster` = 0.
- **FLY:** pods rotate ±90° about the car's X axis so the fans face down, tucked to y ±0.66 and +0.12 m; `nd_thruster` = 1.
- Timing: 0.8 s, easeInOutCubic.

`hover-car.json` has the per-wheel poses and the composition rule (chassis quaternion · fold · spin). `hover-car-assembled.glb` has the same motion as `drive_to_fly` / `fly_to_drive` clips. Use the recommended `physicsOptions` in the JSON for the new body (wheels at x +0.72 / −0.68, y ±0.74; chassis 2.35 × 1.3 × 0.9).

### 11.1 State machine (owned by a new `World/HoverCar.js` controller that wraps `physics.car`)

`GROUNDED` → (take-off pressed, speed under 60% of max, not in arcade or tour) → `TAKEOFF` (0.8 s) → `FLYING` → (land pressed, or descend held with ground under 1.5 units) → `LANDING` (0.8 s) → `GROUNDED`.

- **TAKEOFF:**
  - Remove the `RaycastVehicle` from the world (cannon's vehicle remove call); keep the chassis body.
  - Animate the wheel pods 0° to 90° (horizontal, thruster-down).
  - Thrusters ramp up, the camera blends to the flight chase, and a takeoff cue plays.
  - Apply a lift impulse to reach about 3 units.
- **FLYING:** an arcade flight model applied each physics step.
  - Gravity is cancelled by an upward force equal to mass × gravity.
  - Horizontal velocity is steered toward a target velocity (throttle along heading) with a force-based controller, so collisions still push the car around.
  - Yaw comes from steering input (angular velocity toward the target yaw rate).
  - Pitch and roll **auto-level** with a damped spring. The car leans visually into turns and climbs, but the physics stays stable.
  - Climb and descend set a target vertical velocity.
  - Hover bob: tiny sinusoidal z offset on the **visual mesh only**, off under reduced motion.
- **LANDING:** ray down against static bodies to find the surface z. Ease the car down, rotate the pods back, re-add the `RaycastVehicle`, and settle.
- If landing is requested over no valid surface (for example over a skybridge gap), descend until a surface is found.

### 11.2 Starting values (tune in debug GUI `#debug`)

| Parameter | Value |
|---|---|
| Cruise speed | 18 units/s |
| Boost speed | 30 units/s |
| Acceleration time to cruise | 1.6 s |
| Yaw rate max | 1.6 rad/s (1.1 at boost) |
| Climb / descend rate | 8 / 10 units/s |
| Visual bank max | 25° |
| Visual pitch max | 12° |
| Min altitude above surface | 1.5 units |
| Ceiling | 160 units (climb eases from 150) |
| Boundary soft zone | 10 units inside the flight bounds |
| Linear damping (flying) | 0.4 |

### 11.3 Contracts other systems rely on (must hold in all states)

- `physics.car.speed` and `physics.car.angle` are updated in flight. Camera FOV kick, sounds, minimap, city reflection and `ExperienceHUD` read them.
- Expose `physics.car.mode` ('grounded' | 'takeoff' | 'flying' | 'landing') and `physics.car.altitude` (height above the surface below).
- The `portfolio:navigate` event, guided tour and arcade **force a landing first**. Instant-land with a 0.4 s fade is acceptable when called by the tour.
- **Zones and areas:** ordinary proximity zones remain grounded-only. Entry areas use 162 m square light columns and explicit Enter/touch activation from the sky, matching the expanded flight ceiling. E/Q remain climb/descend, and conversations/interior stations never activate overhead.
- `TireEffects` (skid marks and smoke) are off while flying. `ParticleTrails` switch to thruster particles in blue.
- Headlight cones (`AdvancedLighting.updateHeadlightCones`) follow the chassis orientation in flight.
- The ground reflection quad in `City.js` projects onto the surface below and fades with altitude.

### 11.4 Feedback ("juice")

- Thruster emissive scales with throttle.
- Under-car light beam and ground glow appear when under 8 units above a surface.
- Rain streaks and speed lines at boost (off under reduced motion).
- A small camera shake on building bumps. The existing camera shake respects reduced motion.
- Hover hum pitch follows speed, plus a thruster burst on takeoff and boost (section 14.12).

### 11.5 Cockpit, working speedometer and minimap (first person)

The cabin is built after `cyberpunk inspo vids/Screenshot_20261008-182511.png`:
- open glass bubble with bronze pillars
- centred seat with tan leather door cards and a right-hand armrest
- yoke with a cyan strip
- full-width dash display, mirror screen, windscreen HUD

See `docs/screenshots/neon-district/first-person-cockpit.jpg`.

**Camera:** `Explorer.updateCamera()` for the car becomes eye = chassis body + 0.64 up and −0.05 along the heading. Pitch −6°, FOV 75, near 0.05.

**Dashboard (`nd_dash`, 1.0 × 0.155 m):** a `CanvasTexture` of 1024 × 160, redrawn at about 15 Hz. Layout is `textures/dash_mock.png`:
- **Speed:** large km/h from `physics.car.speed`. Calibrate so boost max reads about 180 in drive and 260 in flight.
- **Status:** AUTOPILOT (ASSISTED during the guided tour, MANUAL otherwise), MODE DRIVE/FLIGHT, ALT from `physics.car.altitude`, LANE (nearest `layout.lanes` when flying), BOOST.
- **Minimap:** a circular **working minimap**. Refactor `Minimap.js` so its projection and draw routine can render into any 2D context, then call it for both the HUD radar and the dash. The same POIs, rotation and player arrow appear in both.
- **Next stop:** arrow, distance and name. Use the guided-tour target if one is active, else the nearest unvisited project board or career door.

**Mirror and HUD:**
- `nd_mirror`: a 128 × 40 rear render target on High/Ultra, updated at 10 Hz; static gradient on Medium/Low.
- `nd_hud`: additive speed readout and heading tick, visible only in first person.
- The DOM HUD speed/altitude readouts hide in first-person car mode, since the dash replaces them.

**Glass and drive mode:** canopy glass (`nd_glass`) is transparent, sorted after opaque. In drive mode the cabin is the same; only the pods and glow change.

---

## 12. Camera spec (the "mix")

Replace the single follow logic with a **rig** in `Camera.js` that blends between named poses. Blends take 0.6–0.9 s with ease in/out, and are instant under reduced motion.

| Rig | When | Pose |
|---|---|---|
| **Chase (ground)** | Driving in the open city | 7 units behind, 2.6 up, looking 4 units ahead of the car; FOV 55 plus the existing FOV kick |
| **Chase (flight)** | Flying | 9 behind, 3.2 up, look-ahead 6, slight lag on yaw so turns read; FOV 60 plus kick |
| **Showcase** | The car or walker is inside a showcase volume: intro plaza, each Project Avenue board, information, arcade start pads, crossroads sign | Existing angled cameras (`angle.items.default` / `projects`) at existing zoom; FOV 40 |
| **On-foot follow** | Walking in the open city | Over the shoulder: 3.6 behind, 1.9 up, drag or right-stick to orbit ±60° |
| **First person** | V toggled | Existing `Explorer.updateCamera()`. In the car: the cockpit eye from section 11.5, with a live dashboard (speed + minimap). On foot: eye height as today. |
| **Game** | Arcade rounds | Existing arcade cameras, unchanged |
| **Classic** (user setting, C) | Always, instead of chase and on-foot follow | Today's angled follow camera everywhere. Also the default when `prefers-reduced-motion` is set. |

**Camera collision:**
- For chase and on-foot rigs, cast a ray from the target to the desired camera position against a **list of building collision boxes** (ray-vs-AABB on the same boxes `NeonCity` creates, not mesh raycasts).
- If something blocks, pull the camera in to 0.5 units before the hit. Ease back out over 0.4 s.
- Clamp the camera z above 0.6 units.

**Showcase volumes** are simple axis-aligned rectangles defined next to each section (data in a new `cameraZones.js`). Exiting a volume blends back to the chase camera.

Keep `camera.targetOverride` (used by the tour and director) working: when set, it wins over every rig.

---

## 13. On foot, rooftops, characters, NPCs

### 13.1 Exit and enter

- `Explorer.exitCar()`: replace the `car.position.z > 2` check with `physics.car.mode === 'grounded' && speed < threshold`.
- Spawn the walker at the **surface height** under the chosen exit offset (ray down), not at a fixed `z = 0.6`. Keep the existing candidate-offset overlap test.
- The "Walk back to your F1 car" text becomes "Walk back to your car".

### 13.2 Rooftop pads

- There are 4 pads (section 8.4). Each has railings (collision boxes) and a **lift door** zone.
- The lift uses the existing zone prompt (`CareerRPG.registerZone`) and moves the walker between the street door and the pad with a fade (reuse the `Interiors.enter/leave` style). The car stays where it was parked.
- If the car is parked on a pad and the player takes the lift down, it stays on the pad. "Get in" only works within 4 units, as today.
- The guided tour's force-enter (`enterCar(true)`) teleports the walker into the car wherever it is. That's fine.

### 13.3 Crowd

- Replace the box people (`createPerson`) with `npc.glb` + VAT (built; decode rules in `npc-vat.json`). One instanced draw with per-instance clip, phase and variant 0–5.
- Keep all 12 `Pedestrians.js` routes and add 20–60 more on sidewalks, by tier.
- NPCs face their walk direction and idle-talk in pairs at a few spots (kiosks, noodle bar).
- No physics, as today.
- The **six career NPCs** (`CareerNPCs.js`) keep their dialogue and positions but use the new mesh, holo name tags and a cyan "talk" ring.
- `createPerson` must stay exported, because `Explorer` uses it for the avatar. Have it return the new player mesh, or switch `Explorer` to the new skinned player.

### 13.4 Skateboard (and hoverboard)

- Keep the skateboard as the **default board**: `skateboard.glb` (built) replaces `Explorer.createBoard()`.
  - Spin the four `skateboard_wheel_*` nodes about X from walker speed (radius 0.045).
  - Same physics; the player's `skate` clip supplies balance motion while the runtime pins both boot soles to the grip tape and keeps the head upright. Player emissive accents are green, not the crowd's cyan.
- `hoverboard.glb` (built) is an **optional cosmetic**, e.g. a career-shop unlock or an easter egg. It has the same physics and hover pads (`nd_thruster`) instead of wheels.

---

## 14. Portfolio content port

| # | Feature | Files | New style | Must still work |
|---|---|---|---|---|
| 14.1 | Intro / start screen | `IntroSection.js`, `index.html` `.city-welcome`, `design/Richard Simmons - Intro.html` | Dark glass panel, monospace, neon cyan accent, rain visible behind it; START button glows | START, brief, resume links, reveal animation, no-WebGL fallback |
| 14.2 | Projects (6) | `ProjectsSection.js`, `Project.js`, `projectCatalog.js`, `ProjectBoard` shader, `build-billboards.mjs` | Floor boards become **holo panels** (scanlines, accent tint) plus a **hero billboard** per project on the facade above. The billboard art is generated from the same SVGs. | Zone prompts, project picker, links open, catalog order (`test:assets`) |
| 14.3 | Project cinematic / portal | `ExperienceDirector.js` | Restyle panels as monospace HUD; per-project theme tints fog and neon (`activateProjectTheme` → set palette accent) | Slides, cinematic, pause, x-ray, interaction locks |
| 14.4 | Information / contact | `InformationSection.js`, `link-*.glb` | Neon terminals at the Comms Tower base | Contact links open, labels readable |
| 14.5 | Arcade: Midnight Sprint, Neon Bowling | `Arcade.js`, `arcadeRules.js`, `BowlingScoreSystem.js`, `FieldGoalScoreSystem.js`, `arcade-*.glb` | Back-alley neon courtyard; checkpoint arch becomes a holo ring; pins get emissive stripes | All rules in `docs/after-hours-arcade.md`; takeoff disabled during rounds; `test:arcade` |
| 14.6 | Career RPG + interiors | `CareerRPG.js`, `careerData.js`, `Interiors.js`, `createApartment.js`, `createInteriorMaterial.js`, `createStorefront.js` | Doors use the towers' `storefront_door` modules. **Hide the old `createApartment` / `createStorefront` facade meshes in Neon mode** and keep their hover markers and sign boards. **Apartment:** load `apartment-interior.glb` (built) in `Interiors.setRoom()` in place of the old GLB and the beige slabs. Keep the wall colliders and stations; map `apartment_window.jpg` onto `nd_window`. RPG panel restyled to match the HUD. | The apartment stays enterable (door zone, enter/leave, bed/desk/door stations unchanged); save/load, quests, door locks, hired offer, `career.browser.js` |
| 14.7 | Guided tour | `GuidedTour.js` | HUD restyle | Forces landing, then drives as today |
| 14.8 | Minimap | `Minimap.js` | Dark radar, cyan streets, magenta POIs; shows **altitude** and a mode glyph (car / plane / walker) | Rotating radar, project POIs |
| 14.9 | HUD | `ExperienceHUD.js`, `main.css` | Reference style: top-left mark and title; bottom-left speed, altitude and mode; top-right collapsible "Systems" panel (mute, camera style, quality tier, first person). JetBrains Mono, thin borders, dark translucent panels. In first person in the car, the in-cockpit dashboard (section 11.5) replaces the DOM speed/altitude. | Mute, mobile scoreboard clearance logic |
| 14.10 | Easter eggs | `EasterEggs.js` | Konami, lemon, wigs and eggs restyled (emissive accents) | All triggers |
| 14.11 | Weather + day/night | section 7.2, 9.5 | — | Real-time clock, seasons, arcade weather override |
| 14.12 | Audio | `Sounds.js`, `AmbientSounds.js`, `generate-sounds.mjs` | New: hover hum loop, thruster burst, takeoff and land cues, near-miss whoosh, lift ding, neon buzz near signs (spatial and quiet). Ambience: crickets and birds become a distant city drone, sirens, PA chimes and rain on metal. Keep everything synthesized or generated as today, no licensed audio. | Mute, ducking, engine state provider |
| 14.13 | Fireflies | `Fireflies.js` | Floating neon dust and ash particles (same system, recolored, slower) | Reduced motion disables drift |
| 14.14 | Social preview | `static/social/`, `scripts/social-preview.browser.js` | Regenerate the share image from the new city at night | OG tags |
| 14.15 | Diagnostics | `WorldDiagnostics.js` | Hosts the perf overlay (section 15.4) | Existing diagnostics |
| 14.16 | **Career mini-games → 3D** | `CareerGames.js` (replaced by `World/MiniGames/*`), `CareerRPG.js` | Six 3D games, each based on a résumé line: **Packet Run** (Gym, Toyota scale), **Beat Tunnel** (Signal Room, music + Lucid), **Signal / Noise** (Wright State, Knoesis 87%), **Handoff** (new LOOPP shift game), **Containment** (Cabinet, Agent Relay), **Ship It** (new Zoan shift game). Full design: `docs/neon-district-minigames.md`. Assets built. | Same rewards, hours and focus as the old games; the `onDone(passed, summary)` / `destroy()` contract; containment best and quests (`containment`, `trained`) still complete |

---

## 15. Performance plan

### 15.1 Budgets per frame

| Metric | Phone (Medium) | Low | Laptop iGPU (High) | Desktop dGPU (Ultra) |
|---|---|---|---|---|
| Target fps (sustained, 5 min) | **≥ 35** | **≥ 35** (user's hard floor) | ≥ 45 | ≥ 60 |
| Draw calls | ≤ 150 | ≤ 100 | ≤ 250 | ≤ 400 |
| Visible triangles | ≤ 400k | ≤ 200k | ≤ 1M | ≤ 2M |
| Fullscreen passes | 2 (bloom at ¼ resolution + composite) | 1 | 3 | 4 |
| JS time per frame (physics + update) | ≤ 6 ms | ≤ 6 ms | ≤ 5 ms | ≤ 4 ms |

### 15.2 Quality tiers (a single table in a new `src/javascript/Quality.js`; every system reads from it)

| Setting | Ultra | High | Medium | Low |
|---|---|---|---|---|
| Render resolution scale (DPR cap) | 1.5 | 1.25 | 1.0 | 0.75 |
| MSAA | 4 | 2 | 0 | 0 |
| Bloom | ½ resolution, 5 mips | ¼ resolution, 4 mips | ¼ resolution, 3 mips | off (baked halos) |
| Far plane / fog end | 220 | 180 | 140 | 100 |
| Neon spill lights | 16 | 12 | 8 | 4 |
| Light beams | 48 | 32 | 20 | 12 |
| Flying traffic | 400 | 250 | 140 | 60 |
| Crowd | 72 | 56 | 36 | 18 |
| Rain lines | 350 | 300 | 180 | 100 |
| Greebles beyond 50 units | yes | yes | no | no |
| Film grain / chromatic aberration | yes / yes | yes / no | no / no | no / no |
| Frame cap | display | display | **60** | **60** |

**Initial tier:**
- Touch device: **Medium**.
- Desktop whose `WEBGL_debug_renderer_info` string contains Intel, UHD, Iris, Mali, Adreno or PowerVR: **High**.
- Apple M-series: **High**.
- Otherwise: **Ultra**.
- `?quality=low|medium|high|ultra` overrides. The HUD Systems panel lets the user pick, saved to localStorage.

### 15.3 Quality governor (replaces `Application.js:393` logic)

- Sample frame time over a window of 45 frames, as today.
- **Step down** one rung when the average is over **26 ms** (headroom under 28.6 ms = 35 fps). Rungs in order:
  1. resolution −0.1, down to the tier floor
  2. MSAA off
  3. bloom mips −1
  4. traffic ×0.6
  5. crowd ×0.6
  6. far plane −20
  7. whole tier down
- **Step up** only after 3 consecutive windows under **16 ms**, and never above the initial tier + 1.
- At most one change every 3 s. Never rebuild render targets more than once a session (existing MSAA lesson).
- A "Low power" hint appears if it settles on Low.

### 15.4 Measurement tools (Phase 0)

- `?perf=1` shows an overlay with fps, frame ms (avg/p95), draw calls, triangles, textures and geometries in memory, the current tier and governor rung, the GPU renderer string and the user agent. Read the numbers from `renderer.info`.
- `?bench=1` runs a **scripted 60 s camera and car path**: spawn, crossroads, Project Avenue flyover, canyon dive, landing at Information. It then prints a JSON summary (avg fps, 1% low, max draws, max triangles, tier) to the console and the overlay. It must be deterministic.
- `npm run dev -- --host` lets the phone load the dev server over Wi-Fi. Remote debugging: Android via `chrome://inspect`; iOS via Safari Web Inspector.

### 15.5 Device matrix

| Device | Role | Status |
|---|---|---|
| Linux development laptop, Intel UHD 620 (observed renderer) | Integrated-GPU laptop floor; must hold ≥ 35 fps on High or auto-settle on Medium | Hardware-accelerated browser available; chassis model not verified |
| **Nothing Phone (3)** | Primary phone target, ≥ 35 fps sustained | Model confirmed; no connected phone / adb tool available. Open `?neon=1&perf=1` on the phone and record the benchmark and GPU/UA line. |
| A recent iPhone (A15 or newer) and a mid Android (Snapdragon 7-series or Pixel 6a class) | Coverage | Real devices or a cloud device lab if the user has one |
| Desktop dGPU | Ultra check | If available |

**Thermal test:** run `?bench=1` 5 times back to back on the phone. The fifth run must still average ≥ 35 fps.

### 15.6 Memory and loading

- iOS Safari kills tabs that use too much memory. Keep the JS heap under 150 MB and GPU textures under 150 MB on the Medium tier.
- First paint of the start screen under 2.5 s on 4G. The 3D world streams in behind the start screen (existing progress events).
- Lazy chunks: interiors, arcade, cinematic images, NPC VAT textures (load after first frame), skyline (after first frame).

---

## 16. Phases

Each phase lists tasks, then **Done when**. Don't start the next phase until the current one is done.

### Phase 0: Foundations and baseline
1. Add `cyberpunk inspo vids/` to `.gitignore`.
2. Build the perf overlay (`?perf=1`) and deterministic benchmark (`?bench=1`) (section 15.4), using **today's** world.
3. Create `Quality.js` with the tier table, detection, URL override and governor. Wire DPR and MSAA through it.
4. Optional: upgrade three to the current release in its own commit, then run all tests and a visual check (section 9.1).
5. ~~Asset budget tests~~ **Done:** `npm run test:cyber-assets`. (The old `test:assets` Zoan URL failure is fixed: the correct URL is `https://zoancollective.com`.)
6. Load the cyber assets in `Resources.js` behind a `?neon=1` flag, so the old city keeps working until Phase 3.
7. Record baseline numbers for the Surface and the user's phone in `docs/neon-district-perf.md`.

**Done when** the overlay and bench work on desktop and phone, the baseline is recorded and the phone model is known.

### Phase 1: Look slice (crossroads block only) ⭐ USER GATE
1. ~~Blender kit, atlas, AO~~ **Done** (section 10). Instance the crossroads part of `district-layout.json` for this slice (towers whose footprint is within 35 m of (0, −30)).
2. CyberMaterial with atlas, AO, height gradient, emissive, lit windows, neon spill and fog (section 9.2).
3. New sky, palettes connected to `DayNightCycle` (section 7.2), **the light volume (section 9.10)**, light beams, the sign atlas (start with 8 designs), the new post chain with bloom tiers.
4. Elsewhere, keep the old city temporarily. Compare against `docs/screenshots/neon-district/*.jpg` (Blender look targets).
5. Debug toggle `?time=HH:MM` to preview any time of day.
   - **Required, because day/night follows real time.** The user must be able to see night at noon.

**Done when:**
- Screenshots of the crossroads at 03:00, 07:00, 13:00 and 19:00 (rain and clear) are sent to the user and **approved**.
- The bench at the crossroads holds **≥ 35 fps on the phone** and ≥ 45 on the Surface.
- Draw calls are within budget.

### Phase 2: Hover car and camera rig
1. ~~Hover car model, pod animation, thrusters, cockpit~~ **Done**. Wire the parts into `Car.js` and apply `hover-car.json` physics options. Add the drive↔fly fold (section 11.0) and the cockpit dash canvas (section 11.5).
2. `HoverCar.js` state machine and flight model (section 11). Maintain the contracts in section 11.3.
3. Camera rig: chase (ground and flight), showcase volumes, on-foot follow, first-person handoff, Classic mode with C, camera collision (section 12).
4. Touch control layout for flight (section 6.3) and keyboard bindings (section 6.2).
5. Hover and thruster audio.

**Done when:**
- On desktop and phone: take off, fly the crossroads canyon, bump a tower, hit the ceiling, land, exit, walk, re-enter, and toggle first person in the car while flying.
- In first person the dash speed matches the HUD speed, and the dash minimap matches the HUD radar.
- Ground-only zones don't trigger from the air; entry columns accept Enter/touch at altitude without stealing the climb key.
- The tour forces a landing.
- A new `scripts/flight.browser.js` passes (section 17).

### Phase 3: City build-out
1. Instance the **whole** `district-layout.json` (all 55 towers, skybridges, pads, street dressing, skyline ring) with tower, skybridge and pad collision boxes. Add the flight boundary.
2. Flying traffic (section 8.6).
3. Spatial cells, LODs and per-cell culling (sections 9.7–9.8).
4. Retire `manhattan.glb` and the matcap assets once nothing references them.

**Done when** the full-city bench holds the tier budgets on the phone and the Surface, and every career door, section origin and arcade gate sits at its old coordinates.

### Phase 4: Characters and crowd
1. Wire `player.glb` (skinned, 6 clips) into `Explorer` and `skateboard.glb` into the board (assets done).
2. Crowd system from `npc.glb` + VAT (assets done); career NPC restyle with holo tags.
3. Rooftop lifts (section 13.2).

**Done when** `explorer.browser.js` and `career.browser.js` pass (updated for new text), and the crowd draw count is ≤ 3.

### Phase 5: Content port
Everything in section 14. Work in this order:
1. Projects
2. Information
3. Arcade
4. Career and interiors (apartment interior + facade hiding)
5. **Career mini-games**, in the order of `neon-district-minigames.md` section 9. The two flight games wait for Phase 2's `HoverCar`.
6. HUD and minimap
7. Intro
8. Easter eggs
9. Audio ambience
10. Social preview

**Done when** every row in section 14's "Must still work" column is checked, all tests pass and the recruiter brief works with WebGL disabled.

### Phase 6: Hardening
1. Tune the governor on real devices; complete the device matrix; thermal test.
2. Accessibility pass:
   - reduced motion (no flicker, no bob, instant camera blends, Classic camera default)
   - focus order of HUD buttons
   - contrast of HUD text over the scene (use a backing panel)
3. Loading audit (≤ 10 MB initial), memory audit (iOS).
4. Update `docs/manhattan-circuit.md`, or replace it with `docs/neon-district.md` (the as-built doc), and update `docs/after-hours-arcade.md`.

**Done when** all budgets in section 15 are met on the matrix and the docs are updated.

### Phase 7: User review ⭐ USER GATE
Send the user the deployed preview link and short recordings of the day and night drive, flight and on-foot loops. Apply feedback.

---

## 17. Testing and verification

**Existing tests (must keep passing)**
- `npm run test:cyber-assets` (new, passing: 7 tests over budgets, attributes, layout doors/pads/infill clearance, car clips and cockpit slots, characters, boards and signs)
- `npm run test:assets`
- `npm run test:arcade`
- `npm run build`
- `scripts/career.browser.js`
- `scripts/explorer.browser.js`
- `scripts/social-preview.browser.js`

Browser scripts run with `npx agent-browser --session <name> eval --stdin < scripts/<file>.browser.js` after entering the site.

**New tests**

- **`scripts/flight.browser.js`**, using the same style as `explorer.browser.js`. It checks:
  - takeoff changes mode to flying and lifts the car above 2 units
  - the ceiling clamp holds
  - landing returns to grounded with the vehicle re-added
  - exit is refused while flying and allowed after landing
  - zones don't fire above 3 units
  - `portfolio:navigate` forces a landing
  - the arcade start refuses takeoff
- **`scripts/minigames.test.mjs`** and **`scripts/minigames.browser.js`**: see `neon-district-minigames.md` section 9.
- **`scripts/quality.test.mjs`** (node) checks:
  - tier detection from sample GPU strings
  - URL override
  - the governor steps down and up with hysteresis on synthetic frame-time series
  - the rung order
- **`scripts/bench.browser.js`** runs `?bench=1` and fails if avg fps is below the tier target or draw calls exceed the budget. Use it on desktop in CI-like runs and manually on the phone.
- ~~Asset budgets~~ **Done** in `scripts/cyber-assets.test.mjs`. Extend it if assets change.
- **Visual check** at each gate: screenshots at the 4 times of day from fixed camera positions, saved to `docs/screenshots/neon-district/` (small JPEGs) for before/after comparison.

---

## 18. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Phone can't hold 35 fps with the look | The Phase 1 gate proves it on one block before the build-out. Tiers and governor. Low tier drops bloom for baked halos. |
| Thermal throttling after minutes | 60 fps cap on phones; 5-run thermal bench; governor steps down |
| Flight breaks systems that assume a grounded car | Contracts in section 11.3, the `flight.browser.js` test, zones gated on altitude |
| The chase camera hides floor-level portfolio content | Showcase volumes switch to the old angled camera; Classic mode toggle |
| The camera clips into buildings | Ray-vs-AABB pull-in on the same collision boxes |
| Motion sickness | Classic camera default under reduced motion; no bob, flicker or chromatic aberration; mild FOV kick |
| Career doors and gates misaligned after the restyle | Coordinate layout locked (rule 2); browser tests cover doors and gates |
| iOS memory kills | KTX2, texture memory cap, lazy chunks, a single skinned mesh |
| Download bloat | Budget tests; retire Manhattan and matcaps; meshopt and KTX2 |
| cannon 0.6.2 quirks with removing and re-adding the vehicle | Prototype in Phase 2 step 2 first; fallback is to keep the vehicle in the world and zero the wheel suspension force while flying |
| three upgrade regressions | An optional separate commit; plan works on 0.164 |
| Legal (reference assets) | Section 4: original or CC0 only, with a credits file |

---

## 19. Open items for the user

1. **Phone measurement.** Model confirmed: Nothing Phone (3). Open the dev URL with `?neon=1&perf=1`, run the five consecutive benchmarks, and send the GPU/UA line and fifth result.
2. Whether the user has access to a cloud device lab for wider phone coverage.
3. Approval at the Phase 1 look gate and the Phase 7 final review. The Blender look targets in `docs/screenshots/neon-district/` can be reviewed now, including the light-volume before/after and the mini-game shots.
4. Sign-off on the six mini-game designs (`docs/neon-district-minigames.md`) before Phase 5 step 5.
5. Blender MCP: Sketchfab, Poly Pizza and Hyper3D need API keys the user enters themselves. AI generators that cost credits are **not to be used** in any case.
