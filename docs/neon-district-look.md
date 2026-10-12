# Neon District: Megacity Look Pass (2026-10-12)

This pass closes part of the gap between the portfolio and mrdoob's three.js port of Unity's Megacity, the reference video in `cyberpunk inspo vids/`. It has two parts. First, it reads Unity's real HDRP settings from the open Megacity sample. Second, it reproduces them on a WebGL budget that phones can run. Nothing from Unity's project is copied into this repo: the licence limits its assets to Unity projects. Only parameter values and techniques were taken.

## Sources

- **mrdoob port (video):** the HUD reads `WEBGPU r187dev`, about 377 draws, 3.1M triangles and 58 fps on an M1. It is not public: there is no live link, because of the asset licence.
- **Unity sample:** [Unity-Technologies/Megacity-2019](https://github.com/Unity-Technologies/Megacity-2019), under the Unity Companion License. The `.asset` volume profiles are Git LFS objects, fetched from `media.githubusercontent.com`.
- **REA ([morluto/rea](https://github.com/morluto/rea)):** used for the runtime side. It captures the site in a real headed Chrome through `capture-browser-scenario`, returning screenshots plus console and page-error events, and runs the `?bench` benchmark from the same Chrome so old and new code are measured identically. It cannot decompile a video or a project that was never published. The Unity settings were read directly from the repo.

## What Megacity's HDRP actually does

The values below are read from the repo (`Assets/Settings/Graphics/Volumes/*`, `Assets/Scenes/Main/Volumes/*`, `Assets/Prefabs/Volumes & Lighting/*`).

### Sun and fog

| Area | Setting |
|---|---|
| Sun | One directional light at 200 lux and 6500 K. The global light-properties volume sets 4200 K, intensity 6. The scene is dim and lit mostly by the sky. |
| Global fog | Volumetric fog with base height 1600 and mean free path 3000 m, so very thin. Colour mode is the sky colour. Volumetric budget 0.35, depth extent 600. |
| Local fog volumes | 12 density volumes with mean free path 16–100 m. They give the canyons their colour: warm grey `(0.45, 0.43, 0.38)`, teal `(0.47, 0.67, 0.66)` and blue `(0.27, 0.45, 0.62)`. |

### Lighting

| Area | Setting |
|---|---|
| Ambient occlusion | SSAO intensity 1.5, direct-lighting strength 0.75 |
| Shadows | Contact shadows, micro-shadowing 0.7 |
| Reflections | SSR, 64 steps |
| Clouds | Volumetric clouds, density 0.4 |

### Post-processing

| Area | Setting |
|---|---|
| Tone mapping | ACES |
| Colour adjustments | Contrast +15, saturation +10 |
| Lift / gain | Lift `(0.92, 0.945, 1)`, gain `(0.9, 0.94, 1)`: a cool shift |
| Shadows tint | `(0.9, 0.925, 1)` |
| Bloom | Intensity 0.47, scatter 0.76 |
| Vignette | 0.5 |
| Chromatic aberration | 0.15 |
| Exposure | Automatic, with adaptation |
| Trench and maze overrides | Film grain 0.26, vignette 0.4–0.53 |

### Materials

Plain HDRP Lit: base, normal, mask, bent-normal and emissive maps (`LitBasicGraph`). Most of the quality comes from the texture detail, AO, local fog colour and the grade above, not from exotic shaders.

## What was implemented

No new render passes and no new draw calls: everything runs in the existing city shader and the existing bloom composite.

### Grade (`src/javascript/Passes/NeonBloom.js`)

- Log-space contrast ×1.15.
- Time-of-day saturation: 0.9 at night, 0.95 by day. The neon art is already saturated, so Megacity's +10 overshot the reference statistics.
- A cool split-tone, then the existing hue-preserving ACES.
- A black lift of 0.018 into a blue-grey, and film grain of 0.03 in display space.
- An elliptical vignette driven by the day cycle (0.35–0.5).
- Chromatic aberration (0.012) on the high and ultra tiers only, since it costs two extra full-resolution texture reads.
- Wider bloom scatter.

### Eye adaptation (`CyberMaterials.update`)

Megacity meters exposure. Here, camera height stands in for metering: by day, exposure opens up to ×1.24 in the shaded street canyons and eases back to ×1.0 in open sky above 45 m.

### Surfaces (`src/shaders/cyber/fragment.glsl`)

- **Weathering:** rain streaks down the walls, blotches, street-level soot and patchy roofs. It fades out between 45 and 110 m before it can alias.
- **Window interiors:** ceiling-light falloff within each storey, half-drawn blinds and brightness that varies across a window, replacing the flat cream panels.
- **Asphalt:** aggregate grain and repair patches. It dries to a mid grey in clear daylight; rain keeps it black and wet.
- **Concrete:** warms toward sandstone by day.
- **Canyon bounce by day:** a warm fill that grows as the sky closes in, standing in for light bounced off the facades opposite.
- **Noise source:** all procedural noise reads a 64×64 tiling texture (`tnoise`), one bilinear fetch instead of four `sin()` hashes. Its mipmaps also anti-alias the detail at distance.
- **Tiering:** the low tier turns all of this off (`uDetail = 0`).

### Fog

- Drifting patches stand in for the local density volumes.
- A linear aerial-perspective term makes towers recede even from altitude. It is weaker by day.
- A teal canyon tint below 30 m.

### Ground contact (`src/javascript/World/groundOcclusion.js`)

A 1024×400 top-down occlusion map is baked once at load (about 175 ms) from the tower footprints and street props in `district-layout.json`. The ground shader reads it once per pixel. It stands in for SSAO plus contact shadows, which phones can't afford.

### Daylight (`CyberMaterials` palette)

- Lower sky fill, so sun and shade separate.
- A bluer zenith and a stronger sun.
- Thinner day haze.
- Clear-sky cloud cover 0.52, down from 0.7.
- Sun warmth driven by real sun elevation, so 9:00 and 17:00 differ from noon.

### Bug fixes found during the pass

- **Black rectangles from the air.** The sky-access column shader evaluated MSAA samples with UVs outside 0–1, so `exp(-edge*48)` overflowed and alpha went far above 1. That wrote Inf/NaN into the half-float target, which the bloom mips then spread as black blocks.
  - The edge and alpha are now clamped.
  - Bloom and composite reject non-finite values, so no single bad pixel can black out the screen again.
- **Red disc over the car at night.** The brake-glow sprite covered the whole rear of the car. It now appears only while braking, and smaller.

## Numbers

### Frame statistics

Statistics come from `scripts/look/frame-stats.py`:

- **Reference:** 49 frames, one every 6 s across the video, with the HUD cropped.
- **Site:** five shot poses each at 21:30 and 13:00.

| Set | Mean luma | p5 | p50 | p95 | p95−p5 | Saturation | Local contrast |
|---|---|---|---|---|---|---|---|
| Reference | 0.187 | 0.033 | 0.139 | 0.486 | 0.453 | 0.285 | 0.046 |
| Night, before | 0.205 | 0.013 | 0.150 | 0.591 | 0.578 | 0.387 | 0.087 |
| Night, after | 0.186 | 0.024 | 0.114 | 0.546 | 0.522 | 0.373 | 0.083 |
| Day, before | 0.225 | 0.059 | 0.177 | 0.539 | 0.480 | 0.240 | 0.062 |
| Day, after | 0.261 | 0.053 | 0.182 | 0.591 | 0.538 | 0.293 | 0.083 |

Night now matches the reference's mean, median and black level. Day saturation matches; day is deliberately brighter and higher in contrast than the reference, which is shot in dim, hazy light.

### Benchmark

- **Method:** REA ran `?bench=1` in a headed Chrome on an Intel UHD 620 at the high tier (dpr 0.75), interleaved with a clean checkout of `cab8b23`. Another project's build was running at the same time, which made individual runs noisy.
- **Result:** median 41 fps after against 46 fps before, about 2.5 ms per frame on this GPU.
- **Draw calls:** unchanged (162–164).
- **Phones:** the Nothing Phone (3) is still unmeasured on device.

## Reproducing

```bash
npm run dev    # port 4173
scripts/look/capture.sh /tmp/look aerial 21:30          # shots: street avenue canyon aerial drop horizon
scripts/look/capture.sh /tmp/look street 13:00 rain medium
```

- `?shot=` exists only in dev builds (`LookShots.js`). It parks the car at a fixed pose, hides the HUD, and logs a `look-review` line with the lighting state. `capture.sh` prints that line.
- The video frames for the reference statistics come from:

  ```bash
  ffmpeg -i "cyberpunk inspo vids/5bz2Q_h1I7Uq9NIw.mp4" -vf "fps=1/6,crop=720:620:0:50,scale=360:310" -f rawvideo -pix_fmt rgb24 ref.rgb
  ```

Screenshots (before | after): `docs/screenshots/neon-district/look-*.jpg`.

## Still short of the reference

- **Geometry density.** Megacity draws 3.1M triangles of hand-modelled greebles; the district draws about 220k. Procedural weathering hides some of the gap, but silhouettes stay boxy.
- **True volumetric light shafts and SSR.** The beams are geometry, and wet-ground reflections are approximated from the light volume.
- **Sun direction is fixed** (azimuth −110°, elevation 36°) because the sun-shadow volume is baked. Only its colour and intensity follow the clock.
