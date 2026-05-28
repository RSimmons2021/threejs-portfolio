import * as THREE from 'three'
import gsap from 'gsap'
import resumePdfUrl from '../../../assets/Richard_Simmons__Resume.pdf'

export default class BowlingScoreSystem
{
    constructor(_options)
    {
        // Options
        this.time = _options.time
        this.physics = _options.physics
        this.scene = _options.scene
        this.camera = _options.camera
        this.debug = _options.debug

        // Bowling pins tracking
        this.pins = []
        this.knockedPins = 0
        this.totalScore = 0
        this.strikes = 0
        this.hasShownResumePopup = false

        // UI Elements
        this.scoreboardElement = null
        this.strikeOverlayElement = null
        this.resumePopupElement = null

        this.createScoreboardUI()
        this.createStrikeOverlay()
        this.createResumePopup()

        // Time tick
        this.time.on('tick', () =>
        {
            this.update()
        })

        console.log('🎳 Bowling Score System initialized!')

        // Debug
        if(this.debug)
        {
            this.debugFolder = this.debug.addFolder('bowlingScore')
            this.debugFolder.add(this, 'testStrike').name('Test Strike Animation')
            this.debugFolder.add(this, 'resetScore').name('Reset Score')
        }
    }

    createScoreboardUI()
    {
        // Create scoreboard container
        this.scoreboardElement = document.createElement('div')
        this.scoreboardElement.className = 'bowling-scoreboard'
        this.scoreboardElement.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: linear-gradient(135deg, rgba(107, 127, 63, 0.95), rgba(107, 127, 63, 0.85));
            border: 3px solid #6B7F3F;
            border-radius: 15px;
            padding: 20px;
            color: white;
            font-family: Arial, sans-serif;
            font-weight: bold;
            text-align: center;
            min-width: 200px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            z-index: 100;
            backdrop-filter: blur(10px);
            display: none;
        `

        this.scoreboardElement.innerHTML = `
            <div class="bowling-title" style="font-size: 24px; margin-bottom: 10px; color: #FFD700;">🎳 BOWLING</div>
            <div class="bowling-pins" style="font-size: 18px; margin-bottom: 5px;">Pins: <span id="bowling-pins">0</span>/10</div>
            <div class="bowling-score-text" style="font-size: 18px; margin-bottom: 5px;">Score: <span id="bowling-score">0</span></div>
            <div class="bowling-strikes" style="font-size: 16px; color: #FFD700;">Strikes: <span id="bowling-strikes">0</span></div>
            <div class="bowling-hint" style="font-size: 12px; margin-top: 10px; color: rgba(255,255,255,0.8);">Bowl a strike for a surprise! 🎯</div>
        `

        document.body.appendChild(this.scoreboardElement)

        // Add mobile-specific styles
        const mobileStyle = document.createElement('style')
        mobileStyle.textContent = `
            @media (max-width: 768px) {
                .bowling-scoreboard {
                    top: 10px !important;
                    right: 10px !important;
                    padding: 12px !important;
                    min-width: 140px !important;
                    border-width: 2px !important;
                    border-radius: 10px !important;
                }
                .bowling-scoreboard .bowling-title {
                    font-size: 16px !important;
                    margin-bottom: 6px !important;
                }
                .bowling-scoreboard .bowling-pins,
                .bowling-scoreboard .bowling-score-text {
                    font-size: 13px !important;
                    margin-bottom: 3px !important;
                }
                .bowling-scoreboard .bowling-strikes {
                    font-size: 12px !important;
                }
                .bowling-scoreboard .bowling-hint {
                    font-size: 9px !important;
                    margin-top: 6px !important;
                }
            }
        `
        document.head.appendChild(mobileStyle)
    }

    createStrikeOverlay()
    {
        this.strikeOverlayElement = document.createElement('div')
        this.strikeOverlayElement.className = 'strike-overlay'
        this.strikeOverlayElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: radial-gradient(circle, rgba(255, 215, 0, 0.3), transparent);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 200;
            pointer-events: none;
        `

        this.strikeOverlayElement.innerHTML = `
            <div style="
                font-size: 120px;
                font-weight: bold;
                color: #FFD700;
                text-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
                            0 0 40px rgba(255, 215, 0, 0.6),
                            0 0 60px rgba(255, 215, 0, 0.4);
                animation: strikeAnimation 2s ease-out;
            ">⚡ STRIKE! ⚡</div>
        `

        // Add CSS animation
        const style = document.createElement('style')
        style.textContent = `
            @keyframes strikeAnimation {
                0% {
                    transform: scale(0) rotate(-180deg);
                    opacity: 0;
                }
                50% {
                    transform: scale(1.2) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: scale(1) rotate(0deg);
                    opacity: 0;
                }
            }
        `
        document.head.appendChild(style)

        document.body.appendChild(this.strikeOverlayElement)
    }

    createResumePopup()
    {
        this.resumePopupElement = document.createElement('div')
        this.resumePopupElement.className = 'resume-popup'
        this.resumePopupElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0);
            background: linear-gradient(135deg, #6B7F3F, #800020);
            border: 4px solid #FFD700;
            border-radius: 20px;
            padding: 40px;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            min-width: 400px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            z-index: 300;
            display: none;
        `

        this.resumePopupElement.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
            <div style="font-size: 28px; font-weight: bold; margin-bottom: 15px; color: #FFD700;">STRIKE!</div>
            <div style="font-size: 18px; margin-bottom: 25px;">You bowled a perfect strike!</div>
            <div style="font-size: 16px; margin-bottom: 30px; line-height: 1.5;">
                Would you like to download my resume?<br>
                <span style="font-size: 14px; opacity: 0.8;">(This will only be offered once)</span>
            </div>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="resume-download-yes" style="
                    background: #FFD700;
                    color: #333;
                    border: none;
                    padding: 15px 30px;
                    font-size: 18px;
                    font-weight: bold;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: transform 0.2s;
                ">📥 Yes, Download!</button>
                <button id="resume-download-no" style="
                    background: rgba(255, 255, 255, 0.2);
                    color: white;
                    border: 2px solid white;
                    padding: 15px 30px;
                    font-size: 18px;
                    font-weight: bold;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: transform 0.2s;
                ">No Thanks</button>
            </div>
        `

        document.body.appendChild(this.resumePopupElement)

        // Button hover effects
        const yesBtn = document.getElementById('resume-download-yes')
        const noBtn = document.getElementById('resume-download-no')

        yesBtn.addEventListener('mouseenter', () => yesBtn.style.transform = 'scale(1.1)')
        yesBtn.addEventListener('mouseleave', () => yesBtn.style.transform = 'scale(1)')
        noBtn.addEventListener('mouseenter', () => noBtn.style.transform = 'scale(1.1)')
        noBtn.addEventListener('mouseleave', () => noBtn.style.transform = 'scale(1)')

        // Button click handlers
        yesBtn.addEventListener('click', () => this.downloadResume())
        noBtn.addEventListener('click', () => this.closeResumePopup())
    }

    registerPin(pinBody)
    {
        const pin = {
            body: pinBody,
            originalPosition: {
                x: pinBody.position.x,
                y: pinBody.position.y,
                z: pinBody.position.z
            },
            isKnocked: false
        }
        this.pins.push(pin)
    }

    checkPinsStatus()
    {
        let currentKnockedPins = 0

        for(const pin of this.pins)
        {
            // Check if pin is knocked over (tilted or fallen)
            const isKnocked = pin.body.position.z < 0.2 || // Fallen down
                             Math.abs(pin.body.quaternion.x) > 0.3 || // Tilted
                             Math.abs(pin.body.quaternion.y) > 0.3

            if(isKnocked && !pin.isKnocked)
            {
                pin.isKnocked = true
                currentKnockedPins++
            }
            else if(pin.isKnocked)
            {
                currentKnockedPins++
            }
        }

        // Update knocked pins count
        if(currentKnockedPins !== this.knockedPins)
        {
            const newPinsKnocked = currentKnockedPins - this.knockedPins
            this.knockedPins = currentKnockedPins
            this.totalScore += newPinsKnocked * 10

            this.updateScoreboard()

            // Check for strike
            if(this.knockedPins === this.pins.length && this.pins.length > 0)
            {
                this.onStrike()
            }
        }
    }

    onStrike()
    {
        this.strikes++
        this.totalScore += 50 // Bonus points for strike
        console.log('🎳 STRIKE! Total strikes:', this.strikes)

        this.updateScoreboard()
        this.playStrikeAnimation()

        // Show resume popup on first strike only
        if(!this.hasShownResumePopup)
        {
            setTimeout(() => {
                this.showResumePopup()
            }, 2500) // Show after strike animation
        }
    }

    playStrikeAnimation()
    {
        this.strikeOverlayElement.style.display = 'flex'

        setTimeout(() => {
            this.strikeOverlayElement.style.display = 'none'
        }, 2000)
    }

    showResumePopup()
    {
        this.resumePopupElement.style.display = 'block'

        gsap.to(this.resumePopupElement, {
            scale: 1,
            duration: 0.5,
            ease: 'back.out(1.7)'
        })
    }

    closeResumePopup()
    {
        gsap.to(this.resumePopupElement, {
            scale: 0,
            duration: 0.3,
            ease: 'back.in(1.7)',
            onComplete: () => {
                this.resumePopupElement.style.display = 'none'
                this.hasShownResumePopup = true
            }
        })
    }

    downloadResume()
    {
        console.log('📥 Downloading resume...')

        // Use the bundled resume asset URL so this works in dev and production builds
        const link = document.createElement('a')
        link.href = resumePdfUrl
        link.download = 'Richard_Simmons_Resume.pdf'
        link.rel = 'noopener'
        document.body.appendChild(link)
        link.click()
        link.remove()

        this.closeResumePopup()

        // Show thank you message
        const thankYou = document.createElement('div')
        thankYou.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(107, 127, 63, 0.95);
            color: white;
            padding: 30px;
            border-radius: 15px;
            font-size: 24px;
            font-weight: bold;
            z-index: 400;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `
        thankYou.textContent = '✅ Thanks! Resume downloaded!'
        document.body.appendChild(thankYou)

        setTimeout(() => {
            gsap.to(thankYou, {
                opacity: 0,
                duration: 0.5,
                onComplete: () => thankYou.remove()
            })
        }, 2000)
    }

    updateScoreboard()
    {
        document.getElementById('bowling-pins').textContent = this.knockedPins
        document.getElementById('bowling-score').textContent = this.totalScore
        document.getElementById('bowling-strikes').textContent = this.strikes
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
            x: 100,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
            onComplete: () => {
                this.scoreboardElement.style.display = 'none'
            }
        })
    }

    resetPins()
    {
        for(const pin of this.pins)
        {
            pin.isKnocked = false
            pin.body.position.set(
                pin.originalPosition.x,
                pin.originalPosition.y,
                pin.originalPosition.z
            )
            pin.body.quaternion.set(0, 0, 0, 1)
            pin.body.velocity.set(0, 0, 0)
            pin.body.angularVelocity.set(0, 0, 0)
            pin.body.wakeUp()
        }

        this.knockedPins = 0
        this.updateScoreboard()
    }

    resetScore()
    {
        this.knockedPins = 0
        this.totalScore = 0
        this.strikes = 0
        this.updateScoreboard()
        this.resetPins()
        console.log('🎳 Bowling score reset!')
    }

    testStrike()
    {
        this.knockedPins = this.pins.length
        this.onStrike()
    }

    update()
    {
        if(this.pins.length > 0)
        {
            this.checkPinsStatus()
        }
    }
}
