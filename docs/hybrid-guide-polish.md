# Hybrid guidance and exploration polish

Implemented October 9, 2026. Supersedes the fully player-relative trail in
[bowling-guide-polish.md](bowling-guide-polish.md).

## Guidance

- One dynamic lead arrow stays 2 m ahead of the rendered player, with a 7 m
  street-route lookahead and shortest-arc damping. Rounded junctions prevent
  abrupt right-angle flips: the regression fixture's 20 cm advance changes
  heading by less than 8 degrees instead of the previous roughly 79 degrees.
- The remaining ribbon and chevrons are anchored to the street. Chevrons are
  spaced 7 m apart, fade near the player, and feather out at the visible horizon.
  Information stays cyan; optional play stays violet. Existing direction text
  is unchanged: no new turn-by-turn/actionable instructions.
- Flying uses a direct altitude-level approach, curving into a descent at the
  destination. Passing overhead does not count as arrival. Ground arrival
  hides both batches without dismissing the information card.
- Two draw calls, at most 16 chevrons, 128 ribbon vertices. Ground ribbon
  geometry is uploaded on selection/reroute/landing, not every frame. Flight
  reuses bounded buffers. No new lights, textures, bloom passes or animation
  loops. Reduced-motion navigation remains functional without lead damping.
- The mobile destination card is approximately 83 px tall at 412 x 915. Its
  native 44 px Details button reveals the original Read / Jump / Change actions.

## Walking, skating and mobile UI

- The real CameraRig regression initially failed because on-foot yaw never
  followed the character. Walking and skateboard chase modes now ease behind
  the character; deliberate dragging remains available and idle orbits recenter.
- Held movement captures its starting view basis. Automatic camera rotation
  cannot steer its own movement into a spiral. Release, navigation resets,
  first-person looking and deliberate camera dragging retarget that basis.
- The mobile boost/sprint button becomes BOARD / WALK on foot, using the actual
  skateboard toggle. It remains car boost in the vehicle. Native button labels
  and pressed state expose the current action to assistive technology.
- Arcade and optional career cards start as approximately 62 px mobile strips.
  Games / Progress disclosures retain all eight game choices and career tools;
  expanded content scrolls within a bounded height. The arcade invitation
  replaces the optional career strip rather than stacking over it. Portrait
  and short landscape layouts use the compact form.

## Collision and lighting

- Eighteen project kiosks and six hero walls have real static Cannon boxes
  derived from their transformed asset bounds. The same boxes participate in
  camera obstruction checks. A real walking-body contact test verifies that
  the visible boards cannot be walked through.
- Removed only the reverse/yellow rear halo. Reverse lenses, brake lighting,
  and the NeonLightRig under-car glow are unchanged.

## Verification

- `node --test scripts/*.test.mjs`: 79 passed, zero failures.
- `npm run test:exploration-polish`: actual CameraRig follow, stable held-input
  basis and transformed billboard physics/contact regressions.
- `scripts/mobile-exploration.browser.js`: live mobile follow-camera, held
  movement, touch skateboard toggle, compact cards, real billboard contacts,
  rear-halo removal, expandable game menu and automatic closure on leaving.
  All 13 checks passed at 412 x 915.
- `scripts/dynamic-guide.browser.js`: driving, walking, skating, world-anchored
  route geometry, rerouting, flight/descent, altitude-aware arrival, compact
  disclosure, reduced motion and clearing. Measures actual site render frames,
  excluding RAF callbacks intentionally skipped by the 60 Hz mobile cap.
  All 20 mobile / 19 desktop checks passed at 412 x 915 / 1280 x 800.
- `scripts/follow-input.browser.js` and `scripts/movement.browser.js` now assert
  stable initial input plus a following camera, not the old frozen walking view.
  All 11 live-follow and 21 movement checks passed, including joystick, flight
  and actual raycast-wheel steering. Collapsed and expanded panels were visually
  inspected in daylight at 412 x 915 and landscape 640 x 360; landscape toolbars
  sit in separate rows/columns instead of overlaying the arcade menu.

`npm run build` completes successfully.

Browser viewport checks do not establish a sustained 35 FPS minimum on a
physical Nothing Phone (3). That hardware performance check remains pending.
