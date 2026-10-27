import CANNON from 'cannon'

// Megacity's structure as a height map (scripts/megacity/build_ring.py): one
// cannon Heightfield body for the car, the walker and landing rays, plus cheap
// height / ray queries for the chase camera and exit checks. The district
// clearing is flat (0), so everything inside it behaves exactly as before.
export default class MegacityCollision
{
    constructor(meta, buffer)
    {
        this.origin = meta.origin
        this.cell = meta.cell
        this.nx = meta.nx
        this.ny = meta.ny
        this.heights = new Uint16Array(buffer)
        if(this.heights.length !== this.nx * this.ny) throw new Error('Megacity collision size does not match its manifest.')
    }

    // Height of the structure at a world point (m); 0 on the street and outside the map.
    heightAt(x, y)
    {
        const i = Math.floor((x - this.origin[0]) / this.cell), j = Math.floor((y - this.origin[1]) / this.cell)
        if(i < 0 || j < 0 || i >= this.nx || j >= this.ny) return 0
        return this.heights[i * this.ny + j] / 10
    }

    // Distance along a ray (unit direction) to the first point below the height map, or `length`.
    rayDistance(origin, direction, length)
    {
        const step = this.cell * 0.5
        for(let t = step; t < length; t += step)
        {
            const z = origin.z + direction.z * t
            if(z < this.heightAt(origin.x + direction.x * t, origin.y + direction.y * t)) return Math.max(0, t - step)
        }
        return length
    }

    // A height field turns each sheer wall into a one-cell ramp that a pushed
    // sphere (the walker) can slide up. After every physics step, a body found
    // inside a tower column goes back to its last valid spot and loses the
    // velocity that carried it in. Rooftops and the flat clearing are unaffected.
    guard(body, memory)
    {
        const p = body.position
        if(this.heightAt(p.x, p.y) > p.z + 0.3)
        {
            if(memory.x === undefined) return false
            const dx = p.x - memory.x, dy = p.y - memory.y, length = Math.hypot(dx, dy) || 1
            const into = (body.velocity.x * dx + body.velocity.y * dy) / length
            if(into > 0) { body.velocity.x -= into * dx / length; body.velocity.y -= into * dy / length }
            p.x = memory.x; p.y = memory.y
            return true
        }
        memory.x = p.x; memory.y = p.y
        return false
    }

    createBody()
    {
        // cannon's Heightfield lies in its local XY plane with heights along Z,
        // which is the portfolio's world frame already.
        const data = []
        for(let i = 0; i < this.nx; i++)
        {
            const column = new Array(this.ny)
            for(let j = 0; j < this.ny; j++) column[j] = this.heights[i * this.ny + j] / 10
            data.push(column)
        }
        const body = new CANNON.Body({ mass: 0 })
        body.addShape(new CANNON.Heightfield(data, { elementSize: this.cell }))
        body.position.set(this.origin[0], this.origin[1], 0)
        body.collisionRole = 'megacity'
        return body
    }
}
