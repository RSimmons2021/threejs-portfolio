# Bowling audio, guide motion and character accessories

Implemented October 9, 2026.

- Generated **only two** new ElevenLabs `eleven_text_to_sound_v2` effects: `static/sounds/cyber/bowling-ball.mp3` (0.64 seconds, 11,327 bytes) and `bowling-pins.mp3` (1.12 seconds, 18,851 bytes). Physical resin/wood contacts with a restrained futuristic resonance; no sampled game/movie audio, voices or music. The [official sound-generation endpoint](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) is called only by the local generation script, never the website.
- Separate ball and pin collision settings use near-original pitch, velocity-scaled gain, 90/110 ms cooldowns and a maximum of 2/3 concurrent voices. Missing/late-loading effects do not queue stale impacts. Ended, stopped and failed voices release capacity. Mastered from preserved raw copies to a -4 dBFS target. Skateboard samples and the original cyber audio pack remain unchanged.
- Bowling uses a compact score strip above the lane instead of the bottom-right arcade menu. Small screens temporarily hide the city-navigation bar while playing; landscape uses a single-row strip with full-size controls to leave the pin end of the lane clear too. The optional arcade menu and sprint layout are unchanged. Native 44 px buttons remain available for retry, next frame and exit.
- Guide bearing updates in the existing render phase **after** follow/first-person cameras, using the same smoothed player position as the visible character/car. Shortest-arc, time-based damping prevents full turns at ±180°. Reduced-motion skips damping. Distance labels remain at 4 Hz; the compass and 3D trail now update each rendered frame.
- The initial fixed-coordinate street chevrons have been replaced by the dynamic, player-relative trail described below, following the visitor's request. Still one draw call, no added lights or geometry budget.
- Removed the main character's headphone cosmetic geometry. Old saves retain their purchased headphones as a bag keepsake, but no longer equip them. New purchases cannot wear them. Player GLB, rig, skate stance, head orientation, green accents and crowd assets are unchanged.

## Verification

`node --test scripts/*.test.mjs`: 70 tests passed, including unchanged skateboard hashes, audio decoding, real playback gain/pitch/cooldown/voice limits, stable marker positions and frame-rate-independent shortest-arc damping.

`scripts/bowling-guide.browser.js` reproduced the original card/car overlap and 250 ms guide steps before the fix. The expanded test also checks the full projected car bounds at six lane positions across countdown, running, frame result, pause and final results—not only the starting line. Direction tests require updates on at least 40 of 44 sampled RAF transitions (allowing the existing 60 Hz render cap), with street coordinates remaining fixed as the visitor moves.

Passing layouts: desktop 1280×800, portrait 360×640 and 412×915, and landscape 640×360 and 915×412. Small landscape uses a 58 px strip, including 44 px buttons.

`scripts/bowling-character.browser.js` checks actual Cannon ball/pin contacts, loaded effects, bounded playback, old-save migration and intact rig/green accents. No claim of a measured 35 FPS minimum on Nothing Phone (3); layout emulation is not physical-device performance testing.

Regenerate only these effects: `npm run sounds:bowling`. Master only these effects: `node scripts/master-cyber-sounds.mjs --only=bowling`. Generation skips existing files unless explicitly forced.

## Dynamic guide follow-up

This section records the previous implementation. The subsequent
[hybrid guidance and exploration polish](hybrid-guide-polish.md) keeps a dynamic
lead arrow but replaces the fully moving trail with a street-anchored ribbon
and fewer fading chevrons.

The visitor wanted the 3D arrows to keep moving and pointing from the character, not remain attached to fixed street coordinates. A red-capable test reproduced the frozen first arrow after lateral player movement. The trail now begins 2 m ahead of the **rendered** player position and follows the remaining street corners with continuous 3 m spacing. It updates in the existing render phase alongside the compass, so it moves smoothly instead of jumping at 250 ms intervals. It follows walking, skateboarding and driving; in flight it floats just below the vehicle and points directly toward the selected light column.

Overshot waypoints advance and excursions more than 6 m off the current segment replan from the current position. Arrival hides the trail while leaving the information card available. The 28-instance cap and single draw remain unchanged; marker records and the transform object are reused. Information stays cyan and optional-game guidance violet.

`scripts/dynamic-guide.test.mjs` covers the real render hook, smoothed-position tracking, heading, airborne height, arrival, missed turns, off-route detection, corner spacing and record reuse. `scripts/dynamic-guide.browser.js` exercises all travel modes in the running city. The previous static-coordinate assertion was deliberately replaced by the requested dynamic-follow assertion. Current Node suite: 72 passing tests.
