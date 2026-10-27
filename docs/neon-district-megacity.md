# Neon District inside Unity's Megacity (2026-10-26)

The portfolio district now sits in a clearing cut out of the original Megacity (Unity GDC 2019). It is surrounded by Megacity's modular towers, lit by Megacity's HDR sky and sun, and wrapped in Megacity-style haze.

Every portfolio system is untouched and still runs on the district's own streets:

- drive / fly transformation
- walking, skateboard
- arcade games, mini-games, quests
- apartment, first person
- minimap, guide arrows and trail, sky-access link columns

## Source and licence

- **Source:** the local three.js port at `~/Documents/Github/unity-megacity`, which was only read, never modified. Its art comes from [Unity-Technologies/Megacity-2019](https://github.com/Unity-Technologies/Megacity-2019) at commit `1d90090d`.
- **Licence:** the assets are under the Unity Companion License. `static/models/megacity/LICENCE.md` keeps that licence with the assets. The site owner confirmed they have permission to use them on this site.

## Pipeline: `npm run assets:megacity`

`scripts/megacity/build_ring.py` needs a Python with numpy; Blender's bundled Python works. `resize_texture.py` uses the system Python with Pillow. The script:

1. **Reads** the port's 94 scene sections (1.2M placements).
2. **Converts** Megacity (Y-up) into the portfolio frame (Z-up). The transform rotates +90° about X, then translates so the clearing centre (Megacity x 905, z 1230, street level y 252) lands on the district centre.
3. **Cuts the clearing:** portfolio x −105…200 and y −78…26, covering every district tower. Everything below 120 m inside it is removed.
4. **Calms the clutter** ("less chaotic"):
   - drops all pipe runs and laundry lines, which span canyons in mid-air;
   - drops trash within 250 m and laundry racks within 60 m of the district.
5. **Removes floating pieces.** The export is missing some host geometry, so many props hang in empty air: about 256k props and 11k shacks/scaffolds.
   - Shacks, scaffolds, scaffold panels and roof plates are kept only within 3 m of a wall tile.
   - Wall-mounted props are then kept only within 3 m of a surviving host.
6. **Keeps mirrored placements.** About 10% of Unity placements have a negative determinant. They are stored with a negative X scale, so the stored rotation stays proper, and the materials render double-sided.
7. **Writes three cumulative bands**, at 30 bytes per placement:

   | Band | Placements | Small (< 3 m) | Medium (< 12 m) | Large |
   |---|---|---|---|---|
   | `ring-0` phones | 39,936 | to 60 m | to 250 m | to 600 m |
   | `ring-1` desktop | +61,113 | to 150 m | to 450 m | to 900 m |
   | `ring-2` ultra | +78,259 | to 250 m | to 700 m | to 1,300 m |

8. **Copies** the 169 meshopt glTF models and the HDR sky, and resizes textures to 512 and 1024 px.
9. **Total:** 34 MB on disk. A phone downloads roughly 1.2 MB of placements, about 4 MB of textures, the models its band uses, and the 3 MB sky.

## Runtime

### `MegacityRing.js`

- **Loading:** after the district is up. If loading fails, the district keeps its procedural skyline. `?megacity=0` turns the ring off.
- **Cells:** placements are bucketed into 50 m cubes. Each run (one model in one cell) has its own bounding sphere.
- **Repacking:** when the camera moves, the visible runs are copied into one `InstancedMesh` per model and LOD.
- **LOD:** picked per run and scaled by object size. A 1 m AC unit (6k triangles at full detail) drops to its 24-vertex proxy long before a 50 m wall tile changes.
- **Tile proxies:** about 60 facade tile variants share one material, and many have no LOD chain. Past the near range, each family (25 × 50 m, 12.5 × 50 m, half-height, corners) is drawn with one proxy quad. Half-height families use the tall quad cropped to 25 m, UVs included. A whole family is then a single draw.
- **Materials:** the original PBR set (base, normal, ORM, emissive), with three additions:
  - the district's height fog injected;
  - window emission that follows the clock;
  - "canyon" darkening that dims light toward the street.
- **Shadows (high/ultra):** a static sun shadow map. The ring and sun direction never move, so it is rendered once.
- **Governor:** if the quality governor steps down, the draw distances shrink by 30% per tier; at low the ring is hidden.

### `MegacityAtmosphere.js` (every tier, including low)

- **Sky:** the HDR is the daytime sky dome and the image-based light (`scene.environment`).
- **Orientation:** a proper rotation (not a mirror) maps the Z-up world onto the HDR's Y-up frame. It is turned so the HDR's sun sits over the district's baked sun azimuth.
- **Ring sun:** keeps that azimuth but rises to the HDR sun's 55°; at 36° the 450 m blocks bury every facade in shade.
- **Haze:** with the ring present it thins to the port's values, in Megacity's grey-teal day fog.

## Exploring Megacity (flight envelope and collision)

Once the ring has loaded, the car may leave the district.

- **Flight bounds:** the district bounds grow by each tier's `explore` reach, which stays inside what that tier draws.

  | Tier | Reach |
  |---|---|
  | Medium | 450 m |
  | High | 700 m |
  | Ultra | 950 m |
  | Phones | at most 600 m |

- **Ceiling:** it rises from 160 m to 520 m (`MEGACITY_CEILING`). The sky-access link columns keep their 162 m entrances.
- **Height map:** the build bakes Megacity's large structure (pieces of 12 m and up, 4 m cells) into `collision.bin`. At runtime this is one cannon `Heightfield` body, so these all respect the towers:
  - flying, driving and walking;
  - landing, including on rooftops;
  - wheel rays.
- **Clearing:** it is flat in the height map, so the district's own colliders behave exactly as before.
- **Tower guard:** a height field turns each sheer wall into a one-cell ramp that the walker could slide up. A guard runs after every physics step: a car or walker found inside a tower column returns to its last valid spot, and its velocity into the wall is removed.
- **Chase camera:** it pulls in along the height map, so it never sits inside a tower.
- **Leaving the car:** spots inside towers are rejected.
- **Ground:** the visible ground plane spans 3.2 × 3 km.
- **Hidden ring:** if the quality governor hides the ring at Low, its collision leaves the physics world, and the flight envelope returns to the district.

Browser checks (Playwright, high tier):

| Check | Result |
|---|---|
| Fly into a 295 m tower | Stops at its face (x 204 for a wall at 207) |
| Hold boost at the new east bound | Settles at 910 m for a 900 m bound |
| Land on a 316 m roof | Grounded on it |
| Push the car and the walker into a 48 m tower at street level | Both stop at the base |
| Frame time while flying out there | 16.7 ms |

## Graphics tiers (`Quality.js`)

`detectTier` combines the platform (decided from the user agent before any touch) with a GPU class read from the WebGL renderer string:

| Device | Tier | Megacity |
|---|---|---|
| Software rendering, old phones (Adreno < 640, older Mali/PowerVR) | low | Sky, sun and haze only |
| Older integrated GPUs (Intel HD/UHD, Vega iGPU), mid phones (Adreno 640–7xx, Mali-G57/G6x), iPhone | medium | Band 0, 512 px textures, no shadows, phone-friendly families only, every distant tile as proxy |
| Iris Xe, Apple M1–M4, Radeon 680M+, high-end phones (Adreno ≥ 730, e.g. Nothing Phone (3), Immortalis) | high | Bands 0–1, 1024 px, 2048 shadow map (phones: capped bands and distances) |
| Discrete NVIDIA/AMD, Apple M Pro/Max | ultra | All bands, 1024 px, 4096 shadow map |

## Measurements (Intel UHD 620, Chrome on Linux, REA / Playwright)

| Tier | View | Frame median, ring | Frame median, no ring | Draw calls, ring |
|---|---|---|---|---|
| Medium | street | 16.7 ms | 16.7 ms | 216 |
| Medium | plaza | 16.7 ms | 16.7 ms | 275 |
| Medium | avenue | 16.7 ms | 16.7 ms | 181 |
| High (forced) | street | 16.7 ms (avg 21.6 ms, hitches) | — | 354 |
| High (forced) | plaza | 16.8 ms (avg 33 ms) | — | 439 |

- **Phone emulation** (Android user agent, 412 × 915): detected as mobile, medium profile with about 30k placements, 16.7 ms frames.
- **Optimisation steps:** without 3D cells and size-scaled LODs, high drew 106M triangles at 4 fps. Tile proxies and per-tier family skips took medium from 200 ring draws to 78.
- **Bench route:** the 60 s `?bench` route measured noisy while the machine was loaded.
  - Medium: 25 fps with the ring against 21 fps without.
  - High forced on this iGPU: 13 fps against 21 fps.
- **Not measured:** high and ultra on their intended GPUs, and a real phone.

## Tools

| Command | What it does |
|---|---|
| `scripts/look/capture.sh <dir> <shot> <HH:MM> [weather] [tier]` | REA capture. Shots include `overhead`, `plaza` and `edge`. `SETTLE_MS` waits for the ring; `EXTRA='&ringHide=Pipes,Pent'` hides model families in dev. |
| `scripts/look/bench.sh <tier>` | REA run of `?bench`. It waits for the ring before timing. |
| `npm run test:megacity` | Profiles, placement decoding (including mirrors), LOD scaling, proxy cropping, sky rotation, clearing integrity, manifest files. |

## Known limits

- Some district materials stay in the portfolio's own style, and the district does not receive the ring's shadows.
- Collision is a height map, so tower overhangs and bridges are solid all the way down.
- Distant cities beyond each tier's explore range are not drawn.
- The first view after load shows the procedural skyline for a few seconds while the ring streams in.
- Three browser checks fail on `e6c6ac7` too, before this work:
  - `neon.browser.js`: "Every tower, skybridge and pad collides"
  - `interface-details.browser.js`: "Brief close restores invoking control"
  - `window-borders.browser.js`
