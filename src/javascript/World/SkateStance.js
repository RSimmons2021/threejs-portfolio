import * as THREE from 'three'

// The authored skate clip supplies the upper-body balance motion. Its local
// hip-axis twist is not a world-Z turn, so solve the legs separately: flat boots,
// two fixed contacts on the grip tape, and a small bent-knee riding stance.
export default class SkateStance
{
    constructor(root)
    {
        this.root = root
        const skin = root.getObjectByProperty('type', 'SkinnedMesh')
        root.updateMatrixWorld(true)
        this.hips = skin.skeleton.bones.find(b => b.name === 'hips')
        this.hipPosition = this.hips.position.clone()
        this.hipRotation = this.hips.quaternion.clone()
        const rootInverse = root.getWorldQuaternion(new THREE.Quaternion()).invert()
        this.head = skin.skeleton.bones.find(b => b.name === 'head')
        this.headRotation = rootInverse.clone().multiply(this.head.getWorldQuaternion(new THREE.Quaternion()))
        this.legs = ['L', 'R'].map((side, i) =>
        {
            const bones = ['thigh', 'shin', 'foot'].map(name => skin.skeleton.bones.find(b => b.name === `${name}${side}`))
            const rotations = bones.map(b => rootInverse.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion())))
            const axes = rotations.slice(0, 2).map(q => new THREE.Vector3(0, 1, 0).applyQuaternion(q))
            return { bones, rotations, axes, lengths: [bones[1].position.length(), bones[2].position.length()],
                // Boots extend forward of the ankle; compensate that offset
                // after their 70° turn so both complete soles fit the deck.
                contact: new THREE.Vector3(i === 0 ? 0.075 : 0.005, i === 0 ? 0.30 : -0.30, 0.1) }
        })
        this.turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), THREE.MathUtils.degToRad(70))
        this.hip = new THREE.Vector3(); this.knee = new THREE.Vector3(); this.target = new THREE.Vector3()
        this.direction = new THREE.Vector3(); this.bend = new THREE.Vector3()
        this.rootRotation = new THREE.Quaternion(); this.parentInverse = new THREE.Quaternion(); this.rotation = new THREE.Quaternion()
    }

    aim(bone, from, to, restAxis, restRotation)
    {
        this.direction.subVectors(to, from).normalize()
        this.rotation.setFromUnitVectors(restAxis, this.direction).multiply(restRotation)
        this.rotation.premultiply(this.rootRotation)
        bone.parent.getWorldQuaternion(this.parentInverse).invert()
        bone.quaternion.copy(this.parentInverse.multiply(this.rotation))
        bone.updateWorldMatrix(false, true)
    }

    update()
    {
        this.hips.position.copy(this.hipPosition)
        this.hips.position.z -= 0.055
        this.hips.quaternion.copy(this.hipRotation).premultiply(this.turn)
        this.root.updateMatrixWorld(true)
        this.root.getWorldQuaternion(this.rootRotation)
        for(const leg of this.legs)
        {
            const [thigh, shin, foot] = leg.bones
            thigh.getWorldPosition(this.hip); this.root.worldToLocal(this.hip)
            this.target.copy(leg.contact)
            this.direction.subVectors(this.target, this.hip)
            const distance = Math.min(this.direction.length(), leg.lengths[0] + leg.lengths[1] - 0.0001)
            this.direction.normalize()
            // A knee toward +Y; project the bend perpendicular to the leg.
            this.bend.set(0, 1, 0).addScaledVector(this.direction, -this.direction.y).normalize()
            const along = (leg.lengths[0] ** 2 - leg.lengths[1] ** 2 + distance ** 2) / (2 * distance)
            const bend = Math.sqrt(Math.max(0, leg.lengths[0] ** 2 - along ** 2))
            this.knee.copy(this.hip).addScaledVector(this.direction, along).addScaledVector(this.bend, bend)
            this.aim(thigh, this.hip, this.knee, leg.axes[0], leg.rotations[0])
            this.aim(shin, this.knee, this.target, leg.axes[1], leg.rotations[1])
            foot.parent.getWorldQuaternion(this.parentInverse).invert()
            this.rotation.copy(leg.rotations[2]).premultiply(this.turn).premultiply(this.rootRotation)
            foot.quaternion.copy(this.parentInverse.multiply(this.rotation))
            foot.updateWorldMatrix(false, true)
        }
        // Counter the clip's chest roll: the rider looks ahead with an upright
        // head instead of inheriting the lean of the animated shoulders.
        this.head.parent.getWorldQuaternion(this.parentInverse).invert()
        this.rotation.copy(this.headRotation).premultiply(this.rootRotation)
        this.head.quaternion.copy(this.parentInverse.multiply(this.rotation))
        this.head.updateWorldMatrix(false, true)
    }
}
