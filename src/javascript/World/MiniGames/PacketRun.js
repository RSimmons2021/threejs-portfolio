import { packetLoad, coolPackets, medalByCount } from './rules.js'
import { packetRoute } from './packetNavigation.js'
import { FLIGHT_CEILING } from '../flightRules.js'

const distance = (a, b) => Math.hypot(a[0] - b.x, a[1] - b.y, a[2] - b.z)

export default class PacketRun
{
    constructor(run)
    {
        this.run = run; this.title = 'Packet Run'
        this.duration = 180
        this.instructions = 'Collect cyan boxes, then fly through a large green DROP OFF ring above rack A, B or C. Delivery is automatic—even with one box. Follow the route altitude to clear buildings, then descend into the ring. W/S thrust, A/D turn, E/Q altitude, Shift boost. Serve 34 boxes in 3 minutes; fewer than 6 drops.'
        this.controls = ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyE', 'KeyQ', 'ShiftLeft'].map((hold, i) => ({ hold, label: ['THRUST ↑', 'REVERSE ↓', 'TURN ←', 'TURN →', 'CLIMB ↑', 'DESCEND ↓', 'BOOST'][i] }))
        this.spec = run.world.resources.items.cyberMiniGameSpec.packetRun
        const placements = this.spec.facilities.map(f => ({ name: 'mg_facility_beacon', p: f.beacon, card: `plant_${f.id}` }))
        this.spec.racks.forEach(rack => placements.push({ name: 'mg_rack_tower', p: rack.roof, card: `rack_${rack.id.toLowerCase()}` }))
        run.assets.fixed(run, placements)
        // Large, daylight-readable markers occupy the exact delivery volume.
        this.deliveryMarkers = run.assets.deliveryMarkers?.(run, this.spec.racks)
        this.packets = run.assets.instances(run, 'mg_packet', 24)
        this.ttls = run.assets.instances(run, 'mg_packet_ttl', 21)
        this.live = []; this.carry = 0; this.spawnTimer = 0; this.drop = 0
        this.state = { loads: [0, 0, 0], p95: 0, redTime: 0, served: 0 }
        this.yaw = Math.atan2(-43.35 + 30, -10 + 36)
        this.deliveryNotice = ''
        this.noticeUntil = 0
        const car = run.world.physics.car.chassis.body
        car.position.set(-36, -30, 42)
        car.velocity.set(0, 0, 0)
        run.world.hoverFlight.yaw = this.yaw
        this.pointTarget()
    }
    pointTarget()
    {
        const car = this.run.world.physics.car.chassis.body.position
        const deliver = this.carry > 0 && (this.carry === 3 || this.live.length === 0)
        const candidates = deliver ? this.spec.racks.map(r => r.intakeRing) : this.live.length ? this.live.map(p => p.p) : this.spec.facilities.map(f => [f.beacon[0], f.beacon[1], f.beacon[2] + 6])
        candidates.sort((a, b) => distance(a, car) - distance(b, car))
        const type = deliver ? 'drop' : 'pickup'
        const retain = this.destinationType === type && (type === 'drop' || !this.live.length && this.carry === 0)
        const destination = retain ? this.destination : candidates[0]
        const key = `${type}:${destination.join(',')}`
        if(key !== this.routeKey)
        {
            this.routeKey = key; this.destination = destination; this.destinationType = type
            this.route = packetRoute(car, destination, this.run.world.neonCity?.colliders || [])
        }
        while(this.route.length > 1 && distance(this.route[0], car) < 1.5) this.route.shift()
        this.target = this.route[0]
    }
    update(dt)
    {
        const r = this.run, b = r.world.physics.car.chassis.body
        const forward = r.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'])
        const turn = r.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'])
        this.yaw += turn * dt * 1.6
        const speed = forward * (r.held('ShiftLeft', 'ShiftRight') ? 30 : 18)
        b.velocity.x = Math.cos(this.yaw) * speed; b.velocity.y = Math.sin(this.yaw) * speed
        b.velocity.z = r.axis(['KeyE'], ['KeyQ']) * 10
        b.position.x = Math.max(-72, Math.min(162, b.position.x)); b.position.y = Math.max(-77, Math.min(22, b.position.y)); b.position.z = Math.max(12, Math.min(FLIGHT_CEILING, b.position.z))
        b.quaternion.setFromAxisAngle({ x: 0, y: 0, z: 1 }, this.yaw)
        r.world.hoverFlight.yaw = this.yaw
        this.spawnTimer -= dt
        if(this.spawnTimer <= 0 && this.live.length === 0 && this.carry === 0)
        {
            // Activate the nearest facility's request batch. Remote beacons remain
            // visible, but their queues do not expire before the player can route there.
            const facilities = this.spec.facilities.map(f => [f.beacon[0], f.beacon[1], f.beacon[2] + 6]).sort((a, p) => distance(a, b.position) - distance(p, b.position))
            // TTL is the pickup challenge, not a punishment for the commute.
            // Activate the queue only once the player reaches its beacon.
            if(distance(facilities[0], b.position) < 10)
            {
                this.spawnTimer = 2
                for(let i = 0; i < 3; i++) this.live.push({ p: [facilities[0][0], facilities[0][1] + (i - 1) * 1.6, facilities[0][2]], ttl: 12 })
            }
        }
        this.live = this.live.filter(packet =>
        {
            packet.ttl -= dt
            if(this.carry < 3 && distance(packet.p, b.position) < 5) { this.carry++; r.cue(); return false }
            if(packet.ttl <= 0) { this.drop++; return false }
            return true
        })
        for(let i = 0; i < this.spec.racks.length; i++)
        {
            if(this.carry && distance(this.spec.racks[i].intakeRing, b.position) < 6)
            {
                const count = this.carry
                packetLoad(this.state, i, count); this.carry = 0; r.cue()
                this.deliveryNotice = `DELIVERED ${count} → RACK ${this.spec.racks[i].id}`
                this.noticeUntil = r.elapsed + 2
            }
        }
        if(coolPackets(this.state, dt)) { this.end(); return }
        this.live.forEach((p, i) => { this.packets.set(i, p.p); this.ttls.set(i, p.p, Math.max(0.1, p.ttl / 12)) })
        for(let i = 0; i < this.carry; i++) this.packets.set(this.live.length + i, [b.position.x - Math.cos(this.yaw) * (3 + i), b.position.y - Math.sin(this.yaw) * (3 + i), b.position.z])
        this.packets.commit(this.live.length + this.carry); this.ttls.commit(this.live.length)
        // Never spend half a second pointing at a pickup after cargo changes.
        this.pointTarget()
        const angle = Math.atan2(this.target[1] - b.position.y, this.target[0] - b.position.x)
        const delta = Math.atan2(Math.sin(angle - this.yaw), Math.cos(angle - this.yaw))
        const rack = this.spec.racks.find(rack => rack.intakeRing === this.destination)
        const next = rack ? `DELIVER → RACK ${rack.id} · green DROP OFF ring · fly through to unload` : 'COLLECT → cyan boxes'
        const altitude = this.target[2] - b.position.z
        const vertical = Math.abs(altitude) < 3 ? 'ALTITUDE OK' : `${altitude > 0 ? 'CLIMB E / ↑' : 'DESCEND Q / ↓'} ${Math.round(Math.abs(altitude))}m`
        r.hud(`${this.state.served}/34 delivered · ${this.carry}/3 carried · ${this.drop} dropped · ${Math.ceil(this.duration - r.elapsed)}s`, `${r.elapsed < this.noticeUntil ? this.deliveryNotice + ' · ' : ''}${next} · ${this.route.length > 1 ? 'ROOF-CLEARANCE WAYPOINT · ' : ''}${delta > 0.15 ? '← LEFT' : delta < -0.15 ? 'RIGHT →' : 'AHEAD ↑'} ${Math.round(distance(this.target, b.position))}m · ${vertical} (target ${Math.round(this.target[2])}m) · rack loads ${this.state.loads.map(l => Math.round(l * 100) + '%').join(' / ')}`)
        if(r.elapsed >= this.duration) this.end()
    }
    end()
    {
        const medal = this.drop < 6 && this.state.redTime < 3 ? medalByCount(this.state.served, 34, 40, 46) : null
        this.run.finish(!!medal, `${this.state.served * 30000} requests served; ${this.drop} dropped. Load balancing keeps the tail latency boring.`, medal)
    }
    camera()
    {
        const p = this.run.world.physics.car.chassis.body.position
        this.run.cameraPosition.set(p.x - Math.cos(this.yaw) * 9, p.y - Math.sin(this.yaw) * 9, p.z + 4)
        this.run.cameraLook.set(p.x + Math.cos(this.yaw) * 6, p.y + Math.sin(this.yaw) * 6, p.z)
    }
    frame()
    {
        const p = this.run.world.physics.car.chassis.body.position
        for(const label of this.deliveryMarkers?.userData.deliveryLabels || [])
        {
            // The HUD already names a nearby rack. Don't let a world-space
            // sign grow off-screen or cover the receiving aperture on phones.
            label.visible = Math.hypot(label.position.x - p.x, label.position.y - p.y, label.position.z - p.z) > 28
        }
    }
}
