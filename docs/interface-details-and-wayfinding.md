# Interface details and visitor wayfinding

Implemented October 9, 2026. The whole-site polish uses `interface-details`:
visible focus and native input (`accessibility-1`, `interactivity-1`), clear
download/new-tab labels (`accessibility-3`), copyable email (`accessibility-4`),
touch targets, quiet/reduced motion, stable numerals, themed scrollbars, and
consistent surfaces. No extra blur layers, UI sound effects, or real-time lights.

## Portfolio first

- After the initial descent/touchdown, choose Projects, Experience, Contact, or
  download the Résumé. Pick any of the six specific projects in the chooser.
- `Guide` reopens the chooser. `Overview` and the PDF remain available in the
  city toolbar. The overview includes all six projects in the gallery order.
- Selecting a destination provides a heading, distance, cyan street chevrons,
  `Read now`, and `Jump there`. The chevrons use the district's street spines;
  this is not a general navigation mesh. Flying uses direct heading/distance.
- Experience has its own information column at `(0, -54)`, opening the real
  résumé-based summary—not a locked employer door or career mini-game.
- Optional games have violet navigation, explicit labels, and a separate section
  in the landing chooser. Game prompts are hidden while following an information
  route. No reviewer information requires credits, a score, or game progress.
- The chooser appears once per visit, not after every flight landing. `?guide=0`
  skips automatic arrival presentation for repeat visits/diagnostic benchmarks;
  the Guide button and all information remain available.

## Fixes

- The exported vehicle shell is closed but outward-facing. 76 downward viewing
  rays missed its opaque surfaces with front-face-only rendering. A car-only
  double-sided material fixes these gaps; shared city paint/glass stays unchanged.
  Its shader uniforms still reference live day/night/spill lighting. No new
  vehicle geometry, texture, light, or draw call.
- Arcade practice visitors board their parked car before the game saves its
  return pose. Arena-specific walking/flight games retain their intended mode;
  returning removes the walker collider and restores the seated car state.
  Sprint/bowling also leave first-person view and flight before staging the car.
- Native Enter/Space activation is preserved on game buttons. Begin receives
  focus; hold controls support focused Enter/Space. Select/form/dialog input
  does not also drive/reset the car or trigger a nearby column.
- Dialog return focus, slide selection semantics/counts, media link labels,
  résumé labels, email-copy feedback, mobile tool spacing, and 44px touch targets
  have been refined across the intro, overview, projects, games, and city tools.

## Verification

- `node --test scripts/*.test.mjs`: 65 passing tests, including cabin coverage,
  live lighting uniforms, native UI key ownership, and authored guide routes.
- `scripts/interface-details.browser.js`: desktop/mobile landing, six case
  studies, direct experience access, optional-game separation, all eight on-foot
  arcade entry flows, focused Begin buttons, restored car/collider state, and
  mobile tool clearance. 82 checks in the latest touch-layout run.
- `scripts/camera-interior.browser.js`: 22 checks, including walking/skating
  follow, driving/flying eye attachment, no intro/first-person shake, apartment
  assets/collision/stations, and sound playback.
- Native keyboard selection of DeepSeek in the landing chooser and Enter to
  accept it were checked in Chromium. Enter starts a focused game Begin button.
  Focused Space on the Packet Run climb button holds `KeyE` on keydown and
  releases it on keyup, without passing the key to city controls.
- Reduced-motion emulation reports no portal animation and zero transition
  duration; direction panel buttons measure 44px tall.
- A 60-second guided-route desktop-GPU run at the 412×915 layout measured
  46.4 FPS average, 17.2 FPS 1% low, at High/DPR 0.75 (Intel UHD 620/Mesa).
  Peak: 121 draws / 173,033 triangles. Average exceeds 35, but slow frames do
  not: this does **not** establish a sustained 35 FPS minimum.
- Production build passes. Nothing Phone (3) is not available here: the minimum
  35 FPS on that physical device remains unverified. Browser layout checks are
  not a mobile GPU performance certification.
