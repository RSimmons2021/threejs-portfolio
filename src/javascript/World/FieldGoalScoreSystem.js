import * as THREE from 'three'
import gsap from 'gsap'

export default class FieldGoalScoreSystem
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.physics = _options.physics
        this.car = _options.car
        this.debug = _options.debug

        // Field goal tracking
        this.isJumping = false
        this.jumpStartPosition = null
        this.maxDistance = 0
        this.bestDistance = 0
        this.totalJumps = 0
        this.totalScore = 0

        // Scoring thresholds (like Smash Bros Home Run Contest)
        this.scoringTiers = [
            { distance: 50, points: 1000, name: 'LEGENDARY', color: '#FFD700' },
            { distance: 40, points: 750, name: 'AMAZING', color: '#FF6B6B' },
            { distance: 30, points: 500, name: 'GREAT', color: '#4ECDC4' },
            { distance: 20, points: 300, name: 'GOOD', color: '#95E1D3' },
            { distance: 10, points: 150, name: 'NICE', color: '#F38181' },
            { distance: 5, points: 50, name: 'OK', color: '#FFFFFF' },
            { distance: 0, points: 10, name: 'WEAK', color: '#AAAAAA' }
        ]

        // UI Elements
        this.scoreboardElement = null
        this.jumpResultElement = null

        this.createScoreboardUI()
        this.createJumpResultUI()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        console.log('🏈 Field Goal Score System initialized!')

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('fieldGoalScore')
            this.debugFolder.add(this, 'testJump').name('Test 30m Jump')
            this.debugFolder.add(this, 'resetScore').name('Reset Score')
        }
    }

    createScoreboardUI()
    {
        this.scoreboardElement = document.createElement('div')
        this.scoreboardElement.className = 'fieldgoal-scoreboard'
        this.scoreboardElement.style.cssText = `
            position: fixed;
            top: 100px;
            left: 20px;
            background: linear-gradient(135deg, rgba(128, 0, 32, 0.95), rgba(128, 0, 32, 0.85));
            border: 3px solid #800020;
            border-radius: 15px;
            padding: 20px;
            color: white;
            font-family: Arial, sans-serif;
            font-weight: bold;
            text-align: center;
            min-width: 220px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 100;
            backdrop-filter: blur(10px);
            display: none;
        `

        this.scoreboardElement.innerHTML = `
            <div class="fg-title" style="font-size: 24px; margin-bottom: 10px; color: #FFD700;">🏈 FIELD GOAL</div>
            <div class="fg-distance" style="font-size: 18px; margin-bottom: 5px;">Distance: <span id="fg-distance">0.0</span>m</div>
            <div class="fg-best" style="font-size: 18px; margin-bottom: 5px;">Best: <span id="fg-best">0.0</span>m</div>
            <div class="fg-score-text" style="font-size: 18px; margin-bottom: 5px;">Score: <span id="fg-score">0</span></div>
            <div class="fg-jumps" style="font-size: 16px; color: #FFD700;">Jumps: <span id="fg-jumps">0</span></div>
            <div class="fg-hint" style="font-size: 12px; margin-top: 10px; color: rgba(255,255,255,0.8);">Jump far to score big! 🚀</div>
        `

        document.body.appendChild(this.scoreboardElement)

        // Add mobile-specific styles
        const mobileStyle = document.createElement('style')
        mobileStyle.textContent = `
            @media (max-width: 768px) {
                .fieldgoal-scoreboard {
                    top: 10px !important;
                    left: 10px !important;
                    padding: 12px !important;
                    min-width: 150px !important;
                    border-width: 2px !important;
                    border-radius: 10px !important;
                }
                .fieldgoal-scoreboard .fg-title {
                    font-size: 16px !important;
                    margin-bottom: 6px !important;
                }
                .fieldgoal-scoreboard .fg-distance,
                .fieldgoal-scoreboard .fg-best,
                .fieldgoal-scoreboard .fg-score-text {
                    font-size: 13px !important;
                    margin-bottom: 3px !important;
                }
                .fieldgoal-scoreboard .fg-jumps {
                    font-size: 12px !important;
                }
                .fieldgoal-scoreboard .fg-hint {
                    font-size: 9px !important;
                    margin-top: 6px !important;
                }
            }
        `
        document.head.appendChild(mobileStyle)
    }

    createJumpResultUI()
    {
        this.jumpResultElement = document.createElement('div')
        this.jumpResultElement.className = 'jump-result'
        this.jumpResultElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            text-align: center;
            z-index: 250;
            pointer-events: none;
        `

        this.jumpResultElement.innerHTML = `
            <div id="jump-result-rank" style="
                font-size: 80px;
                font-weight: bold;
                text-shadow: 0 0 20px rgba(0, 0, 0, 0.8),
                            0 0 40px rgba(0, 0, 0, 0.6);
                margin-bottom: 10px;
            "></div>
            <div id="jump-result-distance" style="
                font-size: 48px;
                font-weight: bold;
                color: white;
                text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
                margin-bottom: 10px;
            "></div>
            <div id="jump-result-points" style="
                font-size: 36px;
                font-weight: bold;
                color: #FFD700;
                text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
            "></div>
        `

        document.body.appendChild(this.jumpResultElement)
    }

    detectJumpStart()
    {
        if(!this.physics || !this.physics.car || !this.physics.car.chassis) return

        const carBody = this.physics.car.chassis.body
        const carZ = carBody.position.z
        const carVelocityZ = carBody.velocity.z

        // Detect when car leaves the ground (Z position increases)
        if(carZ > 1.5 && carVelocityZ > 0 && !this.isJumping)
        {
            this.isJumping = true
            this.jumpStartPosition = {
                x: carBody.position.x,
                y: carBody.position.y,
                z: carBody.position.z
            }
            this.maxDistance = 0
            console.log('🏈 Jump started at:', this.jumpStartPosition)
        }
    }

    detectJumpEnd()
    {
        if(!this.physics || !this.physics.car || !this.physics.car.chassis) return
        if(!this.isJumping) return

        const carBody = this.physics.car.chassis.body
        const carZ = carBody.position.z

        // Detect when car lands back on the ground
        if(carZ < 1.0)
        {
            this.isJumping = false
            this.totalJumps++

            // Calculate final distance
            const finalDistance = this.maxDistance

            console.log('🏈 Jump ended! Distance:', finalDistance.toFixed(2) + 'm')

            // Update best distance
            if(finalDistance > this.bestDistance)
            {
                this.bestDistance = finalDistance
            }

            // Calculate score based on distance
            const result = this.calculateScore(finalDistance)
            this.totalScore += result.points

            // Show jump result
            this.showJumpResult(result, finalDistance)

            // Update scoreboard
            this.updateScoreboard()
        }
    }

    trackJumpDistance()
    {
        if(!this.isJumping || !this.jumpStartPosition) return
        if(!this.physics || !this.physics.car || !this.physics.car.chassis) return

        const carBody = this.physics.car.chassis.body

        // Calculate distance from jump start
        const dx = carBody.position.x - this.jumpStartPosition.x
        const dy = carBody.position.y - this.jumpStartPosition.y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if(distance > this.maxDistance)
        {
            this.maxDistance = distance
        }
    }

    calculateScore(distance)
    {
        // Find the appropriate tier
        for(const tier of this.scoringTiers)
        {
            if(distance >= tier.distance)
            {
                // Add bonus points for extra distance beyond threshold
                const bonus = Math.floor((distance - tier.distance) * 10)
                return {
                    ...tier,
                    points: tier.points + bonus,
                    distance: distance
                }
            }
        }

        return this.scoringTiers[this.scoringTiers.length - 1]
    }

    showJumpResult(result, distance)
    {
        const rankElement = document.getElementById('jump-result-rank')
        const distanceElement = document.getElementById('jump-result-distance')
        const pointsElement = document.getElementById('jump-result-points')

        rankElement.textContent = result.name
        rankElement.style.color = result.color
        distanceElement.textContent = distance.toFixed(1) + 'm'
        pointsElement.textContent = '+' + result.points + ' PTS'

        // Animate in
        gsap.fromTo(this.jumpResultElement,
            {
                scale: 0,
                rotation: -15
            },
            {
                scale: 1,
                rotation: 0,
                duration: 0.5,
                ease: 'back.out(2)'
            }
        )

        // Animate out
        setTimeout(() => {
            gsap.to(this.jumpResultElement, {
                scale: 0,
                opacity: 0,
                duration: 0.3,
                ease: 'back.in(1.7)',
                onComplete: () => {
                    this.jumpResultElement.style.opacity = 1
                }
            })
        }, 2500)
    }

    updateScoreboard()
    {
        document.getElementById('fg-distance').textContent = this.maxDistance.toFixed(1)
        document.getElementById('fg-best').textContent = this.bestDistance.toFixed(1)
        document.getElementById('fg-score').textContent = this.totalScore
        document.getElementById('fg-jumps').textContent = this.totalJumps
    }

    showScoreboard()
    {
        this.scoreboardElement.style.display = 'block'

        gsap.to(this.scoreboardElement, {
            x: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'power2.out'
        })
    }

    hideScoreboard()
    {
        gsap.to(this.scoreboardElement, {
            x: -100,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => {
                this.scoreboardElement.style.display = 'none'
            }
        })
    }

    resetScore()
    {
        this.maxDistance = 0
        this.bestDistance = 0
        this.totalJumps = 0
        this.totalScore = 0
        this.updateScoreboard()
        console.log('🏈 Field goal score reset!')
    }

    testJump()
    {
        const result = this.calculateScore(30)
        this.showJumpResult(result, 30)
        this.totalScore += result.points
        this.totalJumps++
        this.bestDistance = Math.max(this.bestDistance, 30)
        this.updateScoreboard()
    }

    update()
    {
        this.detectJumpStart()
        this.trackJumpDistance()
        this.detectJumpEnd()
    }
}
