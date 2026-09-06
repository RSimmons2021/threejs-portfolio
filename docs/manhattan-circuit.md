# Manhattan Circuit

The portfolio now uses an original Blender F1-style car and a stylized New York streetscape: 36 towers with stepped crowns, spires, window grids, water tanks, awnings, crosswalks, traffic signals, and green NYC street signs. Purple urban ginkgo trees replace the yellow trees. The old statues, pedestals, raised road tiles and obsolete collision bodies are retired. The playground now hosts [After Hours Arcade](after-hours-arcade.md). Foreground block 32 is omitted to keep the contact links visible and accessible; block 29 sits at the district's western edge to keep the arcade camera clear.

## Asset workflow

- Editable source: `assets/blender/manhattan-circuit.blend`.
- Rebuild in Blender's Python console with `exec(compile(open('/absolute/path/to/scripts/build-city-assets.py').read(), '/absolute/path/to/scripts/build-city-assets.py', 'exec'), {'__file__': '/absolute/path/to/scripts/build-city-assets.py'})`.
- The script creates an isolated scene, restores the previously active scene, and exports only selected objects from the new scene. Z remains up to match the existing physics world.
- Exported models live in `static/models/nyc/`. The five car parts total about 75 KB; Manhattan is about 1.93 MB / 36,460 triangles. Four custom contact landmarks total about 78 KB. No downloaded model dependencies.
- `npm run assets:billboards` regenerates all 18 SVG illustrations from the shared project catalog.
- `npm run test:assets` verifies gallery order, destinations, artwork availability, GLB isolation, material colors, axle centering, and asset budgets.

## Rendering choices

The shared shader uses three lighting bands, a warm directional highlight, cool rim light, and the existing animated car spotlight. A ground reflection quad adds a moving light streak; projected city shadows are merged into one mesh. These approximate the requested ray-traced lighting style without actual ray tracing or live reflection captures.

Geometry is grouped by material within each building so off-screen blocks are culled. Physics uses 36 simple building boxes rather than detailed window geometry. Sign supports use one instanced draw. The two fullscreen blur passes are disabled to keep cel edges crisp and reduce fill-rate cost. Adaptive pixel ratio ranges from 0.75 to native density (capped at 1.5 desktop / 1.25 touch), avoiding needless supersampling and allowing integrated GPUs to recover during rain. DOM text stays native-resolution. Display color conversion is applied once in the final composition pass.

The ground uses world-space dark paving, service panels, cyan/magenta inlays and wet reflections. Rain uses 350 wind-angled line segments and 64 instanced splash rings; snow keeps the drifting particle field. Reduced-motion mode disables precipitation. Both the tour guide and previous-visit replay use the same Blender F1 chassis and wheels as the driver.

Roads sit below the existing floor labels, interaction zones, and contact shadows. The camera far plane and minimap cover the extended six-project avenue. Visitors can drive between projects or use the labeled project picker.

## Project sources

1. [Zoan Collective](https://zoancollective.site) — retained studio project.
2. [Agent Lab](https://ai-agent-portal-site.vercel.app/) — `README_agent_portal_site.md`.
3. [DeepSeek Harness Desktop](https://github.com/RSimmons2021/deepseek-harness-desktop) — repository README; described as a fork, with upstream attribution.
4. [Agent Relay](https://openai-agent-site.vercel.app/) — `README_openai_agent_site.md`; identified as an independent application.
5. [Lucid](https://www.lucid-app.xyz/) — retained audio project.
6. [ASO Audit Agent](https://layers-aso-agent.vercel.app/) — `README_audit_agent.md`.

FocusFi was removed from the gallery and its three unused billboard SVGs were removed. Git retains their history.
