# After Hours Arcade

Choose **Play** in the tour or pull into either labeled arcade start pad. Games are optional; Exit game / Escape returns to exploring, and navigating elsewhere cancels the round.

## Midnight Sprint

- Eight ordered, directional checkpoint crossings along Project Avenue.
- Drive east in the upper lane, turn around beyond gate four, then return west in the lower lane.
- A three-second countdown precedes the run. Gold: 32 seconds or less; silver: 42 seconds or less; bronze: finish within the 75-second limit.
- Local personal-best runs record a capped 10 Hz ghost. A ghost appears after the first completed run; no backend or public leaderboard is used.
- Out-of-order gates, wrong-direction crossings, wrong lanes, and teleport-sized jumps do not count.

## Neon Bowling

- Three independent eight-second frames, ten pins per rack, maximum 30 pins.
- Drive left into the ball or pins. Knockdowns use each physics body's tilt, counted once per frame.
- A strike ends the frame early. Next frame resets the rack, ball, car, and their velocities.
- Gold: 25 pins; silver: 18; bronze: 10. A missed frame still advances, so the visitor cannot get stuck.
- A fixed lane camera keeps the whole game in view; portrait uses a more lengthwise angle.

## Visual and performance choices

The Blender-authored courtyard uses teal lane paint, cream graphics, coral pin stripes, dark outlines, shuttered brick storefronts, a fire escape, a side fence, and small tire stacks. Labels use high-contrast canvas textures rather than depending on emissive bloom. The daylight and night palettes remain compatible with the site's existing cycle.

Courtyard geometry is batched by material. Checkpoints reuse one movable arch, with no collision body. The new courtyard and pin GLBs total about 152 KB. The old playground scenery and two competing scoreboards are retired; a smaller off-road brick wall remains a free-play toy.

Timed rounds temporarily select clear weather while retaining the day/night cycle and the same driving grip. Previous weather and tour settings are restored on exit. Other interaction areas are disabled during rounds. Switching tabs pauses the game and requires a fresh countdown to resume. Storage failures fall back to session-only bests. Short UI transitions respect reduced motion; no camera shake is added.

## Verification

- `npm run test:arcade`: directional gate crossings, medal thresholds, local-storage validation and unavailable-storage fallback.
- `npm run test:assets`: project assets plus arcade GLB isolation, material colors and byte budgets.
- `npm run build`: production bundle.
- `scripts/build-city-assets.py`: rebuild all Blender assets, including the courtyard and pin. It can also run through the local Blender executable with `--background --factory-startup --python scripts/build-city-assets.py`.

Drift District is not part of this first release; Midnight Sprint and Neon Bowling are the two implemented games.
