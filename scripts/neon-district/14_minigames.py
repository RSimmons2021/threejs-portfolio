"""Step 14: 3D career mini-game assets -> minigames.glb + minigames.json

Six games built from five asset sets (see docs/neon-district-minigames.md):
  PACKET RUN (city, flight)   BEAT TUNNEL (city, flight)   SIGNAL / NOISE (arena)
  HANDOFF + CONTAINMENT (shared triage-line arena)          SHIP IT (rooftop arena)
Arena games are parked outside the city like the apartment (origins in minigames.json).
Slots: nd_atlas, nd_screen (live canvas), nd_card (uv 0..1 -> minigame-atlas.json rect),
nd_belt (conveyor belt, scroll V), nd_glass.
"""
exec(open('/mnt/sdcard/Github/threejs-portfolio/scripts/neon-district/lib.py').read(), globals())
import json

MG = collection('MINIGAMES')
for s in ('nd_card',):
    if not bpy.data.materials.get(s):
        flat_material(s, '#22e5ff', emission=2.0)
built = {}
def make(name, fn, ao=True, ao_dist=0.6):
    mb = MB(); fn(mb)
    ob = mb.build('mg_' + name, MG, ao=ao, ao_dist=ao_dist, ao_samples=12)
    built[name] = ob
    return ob

def ring(mb, r_out, r_in, depth, r, sides=6, rot_y=False):
    """Flat ring in the XZ plane (faces +/-Y), centred at origin. Hex by default."""
    for i in range(sides):
        a0, a1 = i * math.tau / sides + math.pi / sides, (i + 1) * math.tau / sides + math.pi / sides
        o0 = (r_out * math.cos(a0), r_out * math.sin(a0)); o1 = (r_out * math.cos(a1), r_out * math.sin(a1))
        i0 = (r_in * math.cos(a0), r_in * math.sin(a0)); i1 = (r_in * math.cos(a1), r_in * math.sin(a1))
        for y, flip in ((-depth / 2, False), (depth / 2, True)):
            q = [(o0[0], y, o0[1]), (o1[0], y, o1[1]), (i1[0], y, i1[1]), (i0[0], y, i0[1])]
            mb.quad(*(q if not flip else list(reversed(q))), r)
        mb.quad((o0[0], depth / 2, o0[1]), (o1[0], depth / 2, o1[1]), (o1[0], -depth / 2, o1[1]), (o0[0], -depth / 2, o0[1]), r)
        mb.quad((i0[0], -depth / 2, i0[1]), (i1[0], -depth / 2, i1[1]), (i1[0], depth / 2, i1[1]), (i0[0], depth / 2, i0[1]), r)

# ================================================================= PACKET RUN
def _packet(mb):          # 1 m data cube + TTL ring (ring is a separate node so it can shrink)
    mb.box((0, 0, 0), (0.8, 0.8, 0.8), 'neon_cyan', faces={'pz': 'screen_glow', 'nz': 'screen_glow'})
    mb.box((0, 0, 0), (0.9, 0.9, 0.12), 'trim_black')
make('packet', _packet, ao=False)
def _packet_ttl(mb):
    ring(mb, 0.95, 0.85, 0.04, 'neon_white', sides=24)
make('packet_ttl', _packet_ttl, ao=False)
def _beacon(mb):          # facility beacon: rooftop pillar with a number screen and a light column
    mb.box((0, 0, 0.2), (2.2, 2.2, 0.4), 'metal_dark', faces={'pz': 'pad_top'})
    mb.box((0, 0, 1.6), (0.7, 0.7, 2.4), 'metal_mid')
    for s in (-1, 1):
        mb.quad((s * 0.36, -0.3 * s, 1.3), (s * 0.36, 0.3 * s, 1.3), (s * 0.36, 0.3 * s, 2.3), (s * 0.36, -0.3 * s, 2.3), (0, 0, 1, 1), slot='nd_card')
    mb.cyl((0, 0, 2.8), (0, 0, 3.2), 0.5, 'neon_amber', sides=12)
make('facility_beacon', _beacon)
def _rack(mb):            # server-rack tower, 3 x 3 x 6, LED rows + load meter screen on all sides
    mb.box((0, 0, 0.15), (3.4, 3.4, 0.3), 'metal_dark')
    mb.box((0, 0, 3.2), (3.0, 3.0, 5.8), 'trim_black', faces={'ny': 'vent_grille', 'py': 'vent_grille', 'px': 'vent_grille', 'nx': 'vent_grille', 'pz': 'metal_dark'})
    for side in range(4):
        a = side * math.pi / 2; ca, sa = math.cos(a), math.sin(a)
        for k in range(10):
            z = 0.8 + k * 0.42
            p = (sa * 1.52, -ca * 1.52, z)
            mb.box(p, (2.4 if ca else 0.02, 0.02 if ca else 2.4, 0.04), 'signal_green' if k % 3 else 'neon_cyan')
        P = lambda u, z: (u * ca + sa * 1.53, u * sa - ca * 1.53, z)
        mb.quad(P(-1.2, 5.0), P(1.2, 5.0), P(1.2, 5.9), P(-1.2, 5.9), (0, 0, 1, 1), slot='nd_screen')
make('rack_tower', _rack, ao_dist=1.0)
def _intake(mb):          # 5 m delivery ring, flown through along local Y
    ring(mb, 2.6, 2.2, 0.3, 'neon_cyan', sides=8)
    ring(mb, 2.75, 2.6, 0.5, 'metal_dark', sides=8)
make('intake_ring', _intake, ao=False)

# ================================================================= BEAT TUNNEL
def _beat_ring(mb):
    ring(mb, 3.0, 2.7, 0.25, 'neon_magenta', sides=6)
    ring(mb, 3.15, 3.0, 0.4, 'trim_black', sides=6)
    for i in range(6):
        a = i * math.tau / 6 + math.pi / 6
        mb.box((3.2 * math.cos(a), 0, 3.2 * math.sin(a)), (0.25, 0.45, 0.25), 'neon_white')
make('beat_ring', _beat_ring, ao=False)
def _beat_gate(mb):       # big "drop" gate, 12 m
    ring(mb, 6.2, 5.6, 0.5, 'neon_cyan', sides=6)
    ring(mb, 6.5, 6.2, 0.8, 'metal_dark', sides=6)
    for i in range(12):
        a = i * math.tau / 12
        mb.box((6.6 * math.cos(a), 0, 6.6 * math.sin(a)), (0.4, 0.9, 0.4), 'neon_magenta' if i % 2 else 'neon_amber')
make('beat_gate', _beat_gate, ao=False)
def _speakers(mb):        # rooftop speaker stack facing -Y
    for k, (w, z) in enumerate(((2.4, 0.9), (2.0, 2.5), (1.6, 3.8))):
        mb.box((0, 0, z), (w, 1.2, 1.4 if k < 2 else 1.0), 'trim_black')
        for x in ((-w / 4, w / 4) if k < 2 else (0,)):
            mb.cyl((x, -0.61, z), (x, -0.63, z), 0.45 if k < 2 else 0.3, 'metal_mid', sides=14)
            mb.cyl((x, -0.63, z), (x, -0.65, z), 0.18 if k < 2 else 0.12, 'neon_magenta', sides=10)
make('speaker_stack', _speakers)
def _wave(mb):            # 10 m light ribbon segment (bars), lay along the path; bars scale with audio
    for i in range(20):
        h = 0.3 + 0.7 * abs(math.sin(i * 0.9))
        mb.box((-5 + i * 0.5 + 0.25, 0, h / 2), (0.32, 0.08, h), 'neon_cyan' if i % 4 else 'neon_magenta')
make('wave_ribbon', _wave, ao=False)

# ================================================================= SIGNAL / NOISE
def _card(mb):            # holo post card 1.6 x 1.0, both faces nd_card
    mb.box((0, 0, 0), (1.66, 0.04, 1.06), 'trim_black', skip=('ny', 'py'))
    mb.quad((-0.8, -0.021, -0.5), (0.8, -0.021, -0.5), (0.8, -0.021, 0.5), (-0.8, -0.021, 0.5), (0, 0, 1, 1), slot='nd_card')
    mb.quad((0.8, 0.021, -0.5), (-0.8, 0.021, -0.5), (-0.8, 0.021, 0.5), (0.8, 0.021, 0.5), (0, 0, 1, 1), slot='nd_card')
make('post_card', _card, ao=False)
def _bin(colour):
    def f(mb):
        n = 10
        outer = [(1.1 * math.cos(i * math.tau / n), 1.1 * math.sin(i * math.tau / n)) for i in range(n)]
        mb.prism(outer, 0, 1.2, 'metal_dark', top=False)
        inner = [(0.95 * math.cos(-i * math.tau / n), 0.95 * math.sin(-i * math.tau / n)) for i in range(n)]
        mb.prism(inner, 0.1, 1.2, 'trim_black', top=False, bottom=False)
        mb.cyl((0, 0, 1.2), (0, 0, 1.3), 1.12, colour, sides=n, caps=False)
        mb.box((0, -1.12, 0.7), (0.9, 0.02, 0.5), 'trim_black')
        mb.quad((-0.4, -1.135, 0.5), (0.4, -1.135, 0.5), (0.4, -1.135, 0.9), (-0.4, -1.135, 0.9), (0, 0, 1, 1), slot='nd_card')
    return f
make('bin_positive', _bin('signal_green'))
make('bin_neutral', _bin('neon_amber'))
make('bin_negative', _bin('neon_red'))
def _emitter(mb):         # post launcher on a gantry
    mb.box((0, 0, 0.3), (2.0, 2.0, 0.6), 'metal_dark')
    mb.cyl((0, 0, 0.6), (0, -0.4, 2.4), 0.55, 'metal_mid', sides=12, top=0.42)
    mb.cyl((0, -0.4, 2.4), (0, -0.48, 2.5), 0.44, 'neon_cyan', sides=12)
    for x in (-1.2, 1.2):
        mb.box((x, 0, 1.8), (0.2, 0.2, 3.6), 'metal_mid')
    mb.box((0, 0, 3.7), (2.6, 0.3, 0.2), 'metal_mid')
make('post_emitter', _emitter)

def arena_shell(mb, W, D, Ht, floor='concrete_dark', open_front=False):
    mb.quad((-W / 2, -D / 2, 0), (W / 2, -D / 2, 0), (W / 2, D / 2, 0), (-W / 2, D / 2, 0), floor)
    for x in range(int(-W / 2) + 2, int(W / 2) - 1, 2):
        mb.box((x, 0, 0.005), (0.04, D, 0.01), 'neon_cyan')
    for y in range(int(-D / 2) + 2, int(D / 2) - 1, 2):
        mb.box((0, y, 0.005), (W, 0.04, 0.01), 'neon_cyan')
    walls = [((W / 2, D / 2), (-W / 2, D / 2)), ((-W / 2, D / 2), (-W / 2, -D / 2)), ((W / 2, -D / 2), (W / 2, D / 2))]
    if not open_front:
        walls.append(((-W / 2, -D / 2), (W / 2, -D / 2)))
    for (x0, y0), (x1, y1) in walls:
        mb.quad((x1, y1, 0), (x0, y0, 0), (x0, y0, Ht), (x1, y1, Ht), 'metal_dark')          # faces into the room
        mb.quad((x1, y1, Ht - 0.4), (x0, y0, Ht - 0.4), (x0, y0, Ht - 0.35), (x1, y1, Ht - 0.35), 'neon_violet')
    mb.quad((-W / 2, D / 2, Ht), (W / 2, D / 2, Ht), (W / 2, -D / 2, Ht), (-W / 2, -D / 2, Ht), 'metal_dark')
def _lab(mb):
    arena_shell(mb, 20, 14, 6)
    # big back-wall window onto the city (slot nd_window) and a scoreboard
    mb.quad((-6, 6.98, 1.2), (6, 6.98, 1.2), (6, 6.98, 5.0), (-6, 6.98, 5.0), (0, 0, 1, 1), slot='nd_window')     # faces -Y
    mb.quad((3, -6.97, 3.2), (-3, -6.97, 3.2), (-3, -6.97, 5.2), (3, -6.97, 5.2), (0, 0, 1, 1), slot='nd_screen')   # faces +Y
make('lab_shell', _lab, ao=False)

# ================================================================= TRIAGE LINE (HANDOFF + CONTAINMENT)
def _conveyor(mb):        # 4 m straight segment along +Y, belt top at z 0.9, belt slot scrolls V
    for s in (-1, 1):
        mb.box((s * 0.65, 0, 0.82), (0.12, 4.0, 0.2), 'metal_mid', skip=('py', 'ny'))
        mb.box((s * 0.6, 0, 0.4), (0.08, 0.08, 0.8), 'metal_dark')
        mb.box((s * 0.72, 0, 0.92), (0.02, 3.9, 0.02), 'neon_cyan')
    mb.quad((-0.58, -2, 0.9), (0.58, -2, 0.9), (0.58, 2, 0.9), (-0.58, 2, 0.9), (0, 0, 1, 2), slot='nd_belt')
    mb.box((0, 0, 0.78), (1.2, 4.0, 0.2), 'metal_dark', skip=('pz', 'py', 'ny'))
make('conveyor', _conveyor)
def _junction(mb):        # diverter: input on -Y, outputs at +X (auto-file) and -X (escalate) ; paddle node animates
    mb.box((0, 0, 0.45), (2.4, 2.4, 0.9), 'metal_dark', faces={'pz': 'metal_mid'})
    for s, col in ((1, 'signal_green'), (-1, 'neon_amber')):
        mb.box((s * 1.21, 0, 0.6), (0.02, 1.2, 0.3), col)
make('junction', _junction)
def _paddle(mb):
    mb.box((0, 0.5, 1.05), (0.08, 1.1, 0.25), 'hazard')
    mb.cyl((0, 0, 0.9), (0, 0, 1.2), 0.06, 'metal_light', sides=6)
make('junction_paddle', _paddle, ao=False)
def _folder(mb):          # legal case folder (doc card on top: nd_card)
    mb.box((0, 0, 0.06), (0.62, 0.44, 0.12), 'cardboard')
    mb.box((0.2, 0.2, 0.125), (0.18, 0.06, 0.01), 'wood')
    mb.quad((-0.29, -0.2, 0.121), (0.29, -0.2, 0.121), (0.29, 0.2, 0.121), (-0.29, 0.2, 0.121), (0, 0, 1, 1), slot='nd_card')
make('doc_folder', _folder, ao=False)
def _pod(mb):             # tool-call capsule with icon screen
    mb.cyl((0, -0.35, 0.25), (0, 0.35, 0.25), 0.22, 'panel_white', sides=10)
    mb.cyl((0, -0.36, 0.25), (0, -0.4, 0.25), 0.18, 'neon_cyan', sides=10)
    mb.quad((-0.16, -0.2, 0.471), (0.16, -0.2, 0.471), (0.16, 0.2, 0.471), (-0.16, 0.2, 0.471), (0, 0, 1, 1), slot='nd_card')
make('toolcall_pod', _pod, ao=False)
def _scanner(mb):         # arch over the belt with confidence screen facing -Y (the player)
    for s in (-1, 1):
        mb.box((s * 1.0, 0, 1.4), (0.25, 0.5, 2.8), 'metal_mid')
    mb.box((0, 0, 2.9), (2.25, 0.5, 0.35), 'metal_mid')
    mb.box((0, 0, 2.7), (1.8, 0.05, 0.04), 'neon_cyan')
    mb.quad((-0.9, -0.26, 3.1), (0.9, -0.26, 3.1), (0.9, -0.26, 4.1), (-0.9, -0.26, 4.1), (0, 0, 1, 1), slot='nd_screen')
    mb.box((0, -0.05, 4.15), (1.9, 0.4, 0.08), 'metal_dark')
make('scanner_gate', _scanner)
def _drone(mb):           # hovering agent drone with a single eye light (faces -Y)
    mb.ico((0, 0, 0), 0.35, 'panel_white', 1, (1, 1, 0.8), seed=5)
    mb.cyl((0, -0.3, 0.02), (0, -0.36, 0.02), 0.13, 'neon_cyan', sides=12)
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        p = (0.55 * math.cos(ang), 0.55 * math.sin(ang), 0.1)
        mb.cyl((0, 0, 0.1), p, 0.03, 'metal_dark', sides=4)
        mb.cyl(p, (p[0], p[1], p[2] + 0.04), 0.2, 'thruster_blue', sides=10)
make('agent_drone', _drone, ao=False)
def _desk(mb):            # human escalation desk with lamp + screen; an NPC sits behind it
    mb.box((0, 0, 0.74), (1.8, 0.8, 0.06), 'wood')
    mb.box((0, 0.3, 0.37), (1.7, 0.1, 0.74), 'metal_dark')
    mb.box((0.5, 0.1, 1.0), (0.6, 0.04, 0.4), 'trim_black')
    mb.quad((0.22, 0.078, 0.82), (0.78, 0.078, 0.82), (0.78, 0.078, 1.18), (0.22, 0.078, 1.18), (0, 0, 1, 1), slot='nd_screen')
    mb.cyl((-0.6, 0.1, 0.77), (-0.6, 0.0, 1.2), 0.015, 'metal_dark', sides=4)
    mb.cyl((-0.6, -0.02, 1.2), (-0.6, -0.12, 1.15), 0.08, 'lamp_warm', sides=8)
    for i in range(4):
        mb.box((-0.2 + i * 0.05, -0.1, 0.8 + i * 0.03), (0.6, 0.44, 0.03), 'cardboard')
make('human_desk', _desk)
def _chute(mb):           # auto-file chute with a glowing mouth
    mb.box((0, 0, 0.45), (1.4, 1.4, 0.9), 'metal_mid')
    mb.box((0, 0, 0.91), (1.1, 1.1, 0.02), 'trim_black')
    mb.box((0, -0.71, 0.6), (1.0, 0.02, 0.06), 'signal_green')
make('filing_chute', _chute)
def _lever(colour):
    def f(mb):
        mb.box((0, 0, 0.5), (0.5, 0.5, 1.0), 'metal_dark', faces={'ny': 'panel_tech'})
        mb.box((0, -0.26, 0.75), (0.3, 0.02, 0.2), colour)
    return f
make('lever_base_allow', _lever('signal_green'))
make('lever_base_deny', _lever('neon_red'))
def _handle(mb):          # handle pivots at its base (rotate about X)
    mb.cyl((0, 0, 0), (0, 0, 0.7), 0.04, 'metal_light', sides=6)
    mb.ico((0, 0, 0.75), 0.1, 'trim_black', 1, seed=2)
make('lever_handle', _handle, ao=False)
def _alarm(mb):
    mb.cyl((0, 0, 0), (0, 0, 0.2), 0.2, 'metal_dark', sides=10)
    mb.cyl((0, 0, 0.2), (0, 0, 0.45), 0.16, 'neon_red', sides=10)
make('alarm_beacon', _alarm, ao=False)
def _triage_hall(mb):
    arena_shell(mb, 24, 14, 6)
    mb.quad((-8, 6.98, 1.2), (8, 6.98, 1.2), (8, 6.98, 5.0), (-8, 6.98, 5.0), (0, 0, 1, 1), slot='nd_window')
    mb.quad((3.5, -6.97, 3.0), (-3.5, -6.97, 3.0), (-3.5, -6.97, 5.4), (3.5, -6.97, 5.4), (0, 0, 1, 1), slot='nd_screen')
make('triage_hall', _triage_hall, ao=False)

# ================================================================= SHIP IT
def _station(mb):         # workstation kiosk: counter + big screen (nd_screen) + icon plate (nd_card) + progress ring
    mb.box((0, 0, 0.5), (1.6, 0.9, 1.0), 'metal_dark', faces={'ny': 'panel_tech'})
    mb.box((0, 0.1, 1.02), (1.7, 1.0, 0.04), 'metal_mid')
    mb.box((0, 0.35, 1.7), (1.5, 0.08, 0.95), 'trim_black')
    mb.quad((-0.7, 0.305, 1.27), (0.7, 0.305, 1.27), (0.7, 0.305, 2.13), (-0.7, 0.305, 2.13), (0, 0, 1, 1), slot='nd_screen')
    mb.quad((-0.25, -0.455, 0.55), (0.25, -0.455, 0.55), (0.25, -0.455, 0.85), (-0.25, -0.455, 0.85), (0, 0, 1, 1), slot='nd_card')
    n = 20
    for i in range(n):
        a0, a1 = i * math.tau / n, (i + 1) * math.tau / n
        mb.quad((1.1 * math.cos(a0), 1.1 * math.sin(a0) - 0.9, 0.01), (1.1 * math.cos(a1), 1.1 * math.sin(a1) - 0.9, 0.01),
                (0.95 * math.cos(a1), 0.95 * math.sin(a1) - 0.9, 0.01), (0.95 * math.cos(a0), 0.95 * math.sin(a0) - 0.9, 0.01), 'neon_cyan')
make('station', _station)
def _orb(mb):
    mb.ico((0, 0, 0), 0.25, 'neon_white', 2, seed=1)
make('task_orb', _orb, ao=False)
def _phone(mb):           # app phone, screen nd_card (FocusFi / Lucid icons), stands upright, faces -Y
    mb.box((0, 0, 0.8), (0.75, 0.08, 1.5), 'trim_black')
    mb.quad((-0.33, -0.041, 0.1), (0.33, -0.041, 0.1), (0.33, -0.041, 1.5), (-0.33, -0.041, 1.5), (0, 0, 1, 1), slot='nd_card')
make('app_phone', _phone, ao=False)
def _launch(mb):          # small launch pad that the phone lifts off from when shipped
    n = 16
    ringp = [(1.0 * math.cos(i * math.tau / n), 1.0 * math.sin(i * math.tau / n)) for i in range(n)]
    mb.prism(ringp, 0, 0.15, 'metal_dark', cap_r='pad_top', bottom=False)
    for i in range(8):
        a = i * math.tau / 8
        mb.box((1.05 * math.cos(a), 1.05 * math.sin(a), 0.1), (0.15, 0.15, 0.2), 'neon_amber', rot=a)
make('launch_pad_small', _launch)
def _booth(mb):           # App Review booth with a window and stamp light
    mb.box((0, 0, 1.3), (2.0, 1.6, 2.6), 'metal_mid', skip=('ny',))
    mb.box((0, -0.78, 2.45), (2.0, 0.05, 0.3), 'trim_black')
    mb.quad((-0.8, -0.81, 2.32), (0.8, -0.81, 2.32), (0.8, -0.81, 2.58), (-0.8, -0.81, 2.58), (0, 0, 1, 1), slot='nd_card')
    mb.box((0, -0.5, 1.0), (1.9, 0.6, 0.06), 'wood')
    mb.box((0, 0.6, 1.4), (1.9, 0.05, 1.2), 'glass_dark')
    mb.cyl((0.6, -0.5, 1.03), (0.6, -0.5, 1.2), 0.08, 'neon_red', sides=8)
make('review_booth', _booth)
def _roof(mb):            # open-air rooftop studio: deck, railing, cable trays, AC units, string lights
    W, D = 22, 16
    mb.box((0, 0, -0.25), (W, D, 0.5), 'concrete_dark', faces={'pz': 'concrete_mid'})
    for x in range(-10, 11, 2):
        mb.box((x, 0, 0.005), (0.04, D, 0.01), 'neon_cyan')
    for (a, b) in (((-W / 2, -D / 2), (W / 2, -D / 2)), ((W / 2, -D / 2), (W / 2, D / 2)), ((W / 2, D / 2), (-W / 2, D / 2)), ((-W / 2, D / 2), (-W / 2, -D / 2))):
        a3, b3 = Vector((*a, 0)), Vector((*b, 0))
        mb.cyl(a3 + Vector((0, 0, 1.05)), b3 + Vector((0, 0, 1.05)), 0.04, 'metal_mid', sides=6)
        n = int((b3 - a3).length / 1.0)
        for i in range(n + 1):
            p = a3.lerp(b3, i / n); mb.box((p.x, p.y, 0.52), (0.04, 0.04, 1.05), 'metal_mid')
    for x in (-9, -6, 6, 9):
        mb.box((x, 7.2, 0.5), (1.6, 1.0, 1.0), 'metal_light', faces={'ny': 'ac_front'})
    for i in range(16):                                      # string lights across the deck
        t = i / 15
        mb.box((-W / 2 + t * W, 0, 4.0 - 0.6 * math.sin(t * math.pi)), (0.12, 0.12, 0.12), 'lamp_warm')
    mb.cyl((-W / 2, 0, 4.0), (W / 2, 0, 4.0), 0.01, 'cable_black', sides=4, caps=False)
    for x in (-W / 2, W / 2):
        mb.box((x, 0, 2.0), (0.2, 0.2, 4.0), 'metal_dark')
make('rooftop_studio', _roof, ao=False)

# ================================================================= layout data
L = json.load(open(os.path.join(OUT, 'district-layout.json')))
towers = L['towers']
def roof(t):
    c = t['collision']['center']; return [c[0], c[1], t['height']]
# PACKET RUN: 7 facility beacons spread west->east on roofs 28-64 m, 3 racks on infill roofs <= 64 m
cands = sorted([t for t in towers if 28 <= t['height'] <= 64 and not t['id'].startswith(('infill_east', 'infill_west'))],
               key=lambda t: t['collision']['center'][0])
step = max(1, len(cands) // 7)
beacons = [roof(cands[min(i * step + step // 2, len(cands) - 1)]) for i in range(7)]
rack_c = sorted([t for t in towers if t['kind'] == 'infill' and t['height'] <= 64 and t['id'] not in [p['tower'] for p in L['pads']]],
                key=lambda t: t['collision']['center'][0])
racks = [roof(rack_c[i]) for i in (0, len(rack_c) // 2, len(rack_c) - 1)] if len(rack_c) >= 3 else []
packet_run = {
    'mode': 'city flight', 'durationSeconds': 90,
    'facilities': [{'id': i + 1, 'roof': b, 'beacon': [b[0], b[1], b[2]]} for i, b in enumerate(beacons)],
    'racks': [{'id': 'ABC'[i], 'roof': r, 'intakeRing': [r[0], r[1], r[2] + 9.0]} for i, r in enumerate(racks)],
}

# BEAT TUNNEL: path through the avenue canyon (under 2 skybridges, over 1), back west between traffic lanes, dive to the crossroads
ctrl = [(-50, -30, 16), (-25, -30, 15), (-2, -30, 14), (30, -30, 18), (60, -31, 19), (68, -31, 19), (90, -29, 26),
        (108, -30, 27), (130, -32, 28), (150, -30, 32), (160, -26, 40), (150, -24, 46), (110, -27, 46), (60, -33, 46),
        (20, -30, 40), (4, -34, 28), (0, -43, 17), (0, -56, 14), (2, -66, 16)]
pts = [Vector(p) for p in ctrl]
dense = []
for i in range(len(pts) - 1):        # Catmull-Rom
    p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, len(pts) - 1)]
    for k in range(20):
        t = k / 20
        dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
dense.append(pts[-1])
BPM, SPEED = 100, 12.0
spacing = SPEED * 60 / BPM
rings, acc, last = [], 0.0, dense[0]
for p in dense[1:]:
    seg = (p - last).length; acc += seg
    if acc >= spacing:
        acc -= spacing
        tan = (p - last).normalized()
        rings.append({'beat': len(rings) * 1, 'p': [round(v, 2) for v in p], 'forward': [round(v, 3) for v in tan],
                      'kind': 'gate' if len(rings) % 16 == 15 else 'ring'})
    last = p
def clear(p):
    for t in towers:
        c, s = t['collision']['center'], t['collision']['size']
        if all(abs(p[i] - c[i]) < s[i] / 2 + 3.2 for i in range(3)):
            return False
    for b in L['skybridges']:
        c, r = b['center'], b['rotZ']
        dx, dy = p[0] - c[0], p[1] - c[1]
        lx, ly = dx * math.cos(-r) - dy * math.sin(-r), dx * math.sin(-r) + dy * math.cos(-r)
        if abs(lx) < b['length'] / 2 + 3.2 and abs(ly) < 2.1 + 3.2 and c[2] - 3.2 < p[2] < c[2] + 3.4 + 3.2:
            return False
    return True
blocked = [r['beat'] for r in rings if not clear(r['p'])]
beat_tunnel = {'mode': 'city flight on rails (steer within the ring plane)', 'bpm': BPM, 'speed': SPEED,
               'path': [[round(v, 2) for v in p] for p in ctrl], 'rings': rings, 'blockedRings': blocked,
               'audio': 'Procedural WebAudio: 100 BPM kit + pad; binaural drone 200 Hz L / 208 Hz R (8 Hz alpha). Ring hits play a chord stab.'}

arenas = {
    'signal_noise': {'origin': [420, 320, 0], 'shell': 'mg_lab_shell', 'size': [20, 14, 6],
                     'place': {'mg_post_emitter': [[0, 6.0, 0, 0]], 'mg_bin_positive': [[-5, 1.5, 0, 0]],
                               'mg_bin_neutral': [[0, 3.0, 0, 0]], 'mg_bin_negative': [[5, 1.5, 0, 0]]},
                     'player': [0, -2.5, 0], 'note': 'First person on foot facing +Y. Posts arc from the emitter toward the player; flick left = positive bin, right = negative, down = neutral.'},
    'triage': {'origin': [480, 320, 0], 'shell': 'mg_triage_hall', 'size': [24, 14, 6],
               'place': {'mg_conveyor': [[0, 4 + i * -4.0, 0, 0] for i in range(3)] + [[3.2 + i * 4, -6 + 4.6, 0, -1.5708] for i in range(0)],
                         'mg_scanner_gate': [[0, 0, 0, 0]], 'mg_junction': [[0, -6.2, 0, 0]], 'mg_junction_paddle': [[0, -6.2, 0, 0]],
                         'mg_filing_chute': [[3.4, -6.2, 0, 0]], 'mg_human_desk': [[-4.2, -6.2, 0, 1.5708]],
                         'mg_agent_drone': [[0, 0.8, 3.0, 0]], 'mg_lever_base_allow': [[1.6, -4.2, 0, 0]], 'mg_lever_handle': [[1.6, -4.2, 1.0, 0], [-1.6, -4.2, 1.0, 0]],
                         'mg_lever_base_deny': [[-1.6, -4.2, 0, 0]], 'mg_alarm_beacon': [[-11, 6, 5.5, 0], [11, 6, 5.5, 0]]},
               'belt': {'from': [0, 6, 0.9], 'to': [0, -6.2, 0.9], 'speed': 1.2},
               'player': [0, -5.0, 0], 'note': 'HANDOFF uses folder + junction/chute/desk; CONTAINMENT uses pods + levers. Same hall.'},
    'ship_it': {'origin': [540, 320, 0], 'shell': 'mg_rooftop_studio', 'size': [22, 16, 0],
                'place': {'mg_station': [[-7, 3.5, 0, 0], [-2.5, 5.5, 0, 0], [2.5, 5.5, 0, 0], [7, 3.5, 0, 0]],
                          'mg_review_booth': [[8.0, -3.5, 0, -1.5708]], 'mg_launch_pad_small': [[-6, -5, 0, 0], [-2.5, -5, 0, 0]],
                          'mg_app_phone': [[-6, -5, 0.15, 0], [-2.5, -5, 0.15, 0]]},
                'stations': ['CODE', 'BUILD iOS', 'BUILD ANDROID', 'PAYMENTS'], 'skyline': 'textures/apartment_window.jpg as a far backdrop ring',
                'player': [0, 0, 0], 'note': 'On foot or skateboard. Task orbs spawn mid-deck and are carried to stations.'},
}
meta = {'packetRun': packet_run, 'beatTunnel': beat_tunnel, 'arenas': arenas,
        'assets': {k: {'node': 'mg_' + k, 'tris': tri_count(v)} for k, v in built.items()}}
json.dump(meta, open(os.path.join(OUT, 'minigames.json'), 'w'), indent=1)
x = 0
for name, ob in built.items():
    ob.location = (x, -300, 0); x += 4 if name not in ('lab_shell', 'triage_hall', 'rooftop_studio') else 26
print('assets', len(built), 'tris', sum(tri_count(o) for o in built.values()), 'rings', len(rings), 'blocked', blocked, 'beacons', len(beacons), 'racks', len(racks))
