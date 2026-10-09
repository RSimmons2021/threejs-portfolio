# Neon District: Runtime State and Performance

Updated 2026-10-08, after the look pass. **Not yet verified on the physical phone.** The target phone is the Nothing Phone (3); the target is **at least 35 fps sustained**.

## What's running (default URL; `?neon=0` keeps the legacy city)

| Area | Implementation |
|---|---|
| City | `World/NeonCity.js`. The **whole district** from `district-layout.json`: 55 towers, 5 skybridges, 4 pads, street props, signs, a skyline ring. One `InstancedMesh` per module, material and LOD for the entire city; every 100 ms the CPU repacks each mesh with only the instances inside the camera frustum (LOD0 within 50 m, LOD1 beyond; greebles to 80 m). Collision: towers, bridges, pads and street props, plus a box list the camera uses for collision. The old Manhattan towers, NYC signs, trees, fake shadows and cartoon sky/floor are hidden in Neon mode; the street surface stays. |
| Material | `World/CyberMaterials.js` + `shaders/cyber/*`. Smooth overcast hemisphere lighting × baked **light volume** (sky visibility + neon bounce), plus a **key sun** masked by the baked **sun-shadow volume** (`textures/light_sun.png`). Also: glass with haze reflections and sun glints; windows lit per instance (16% at night, 5% by day; warm, cool or TV-blue); exp² height/distance haze; wet streets mirroring the neon. Palette follows the visitor's real clock (dawn/dusk warm the sun). |
| Sky | `World/NeonSky.js`. Blue sky with sunlit cumulus by day (lit tops, grey bellies, silver lining, sun glow), a warm band at dusk, light-polluted clouds at night. Drawn after opaque geometry with a far-plane depth test, so only visible sky pixels shade. |
| Traffic | `World/NeonTraffic.js`. Six vehicle types on the 4 lanes, positioned entirely in the vertex shader: 400 on Ultra, 140 on Medium. |
| Light beams | Instanced fog cones under ledges and lamps, nearest N by tier. |
| Hover car | Hover car GLBs replace the F1, with new physics dimensions. **`World/HoverFlight.js`**: T takes off or lands; W/S thrust, A/D yaw, E/Q climb/descend, Shift boost; gravity cancelled, velocity-tracking flight, 70 m ceiling, soft district walls. Pods fold to fan-down, thrusters glow, the body banks. Zones ignore an airborne car; you can't exit mid-air but can on rooftop pads; tour, project navigation and the arcade force a landing. On touch, ▲/▼ buttons sit above the existing touch column (beside it in landscape). |
| Camera | `World/CameraRig.js`. Chase camera behind the car (wider in flight) or walker. Drag to orbit, wheel/pinch to zoom, pulls in when a tower blocks it. **C** toggles the classic angled camera (saved). First person (V) is unchanged. |
| Cockpit | `World/CockpitDash.js`. The hover car's dashboard is a live canvas at about 15 Hz: speed (same number as the HUD), MODE DRIVE/FLIGHT, ALT, a live minimap (the HUD radar drawn into the dash) and the next project stop with a direction arrow. Eye at body +0.64 m. |

## Measurements (laptop, Intel UHD 620, Chrome on Linux; 1479 × 852 window)

- **Before the look pass's culling work:** 373 draws, 782k triangles in flight down Project Avenue, about 35 fps after the governor dropped to Medium at 0.6 resolution.
- **After global instancing with per-frame frustum packing and back-face culling:** about 257k triangles in the same flight.
- **Frame rate:** 27–48 fps across runs. The laptop is thermally noisy; the same scene varied by up to 15 fps between back-to-back runs.
- **Biggest single costs:** full-detail facade instances (hiding them gives 60 fps) and the full-screen sky. The sky now only shades visible pixels.

The Nothing Phone (3)'s GPU (Snapdragon 8s Gen 4 / Adreno 825) is several times faster than the UHD 620 at a similar pixel count on the Medium tier, so the phone target is **expected but unproven**. Run the phone procedure below before calling it done.

## Phone procedure

1. `npm run dev -- --host 0.0.0.0 --port 4173`, then on the phone (same Wi-Fi) open `http://<laptop-LAN-IP>:4173/?perf=1&time=15:00&weather=clear`.
2. Enter, take off (Take off button), fly Project Avenue for 60 s, then run `?bench=1` five times back to back.
3. Record the GPU/UA line, final tier/DPR, average fps, 1% low and the fifth-run result.

## Verification (all passing)

- `npm run test:assets` 5/5
- `npm run test:arcade` 4/4
- `npm run test:cyber-assets` 11/11
- `npm run test:quality` 10/10
- `npm run build`
- In-page: `scripts/neon.browser.js` 26/26 (full district, traffic, sky, sun day/night, takeoff, climb, altitude hold, zones ignored in the air, no mid-air exit, landing, arcade forces landing, live dash), `scripts/explorer.browser.js` 17/17, `scripts/career.browser.js` 44/44.

## Screenshots

`docs/screenshots/neon-district/`:
- `runtime-day-flight.jpg`
- `runtime-day-sky.jpg`
- `runtime-night-rain.jpg`
- `runtime-cockpit-night.jpg`

## Known gaps

- **Lighting:** the sun direction is art-directed and fixed (afternoon, from the SSW); only its colour and strength follow the clock. No real-time shadows from moving cars.
- **Old portfolio pieces:** the project boards, area floor squares and box-people pedestrians are still the old models (restyled by the new material). The NPC crowd and the six 3D mini-games from `neon-district-minigames.md` are not wired yet.
- **Draw calls:** about 300 at peak, mostly from the legacy portfolio objects; the city itself is about 70.
