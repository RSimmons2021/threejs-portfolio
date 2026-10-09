import { sentimentMedal } from './rules.js'

export default class SignalNoise
{
    constructor(run)
    {
        this.run = run
        this.title = 'Signal / Noise'
        this.instructions = 'Sort 50 posts: A / ← positive, S / ↓ neutral, D / → negative. Swipe or tap the labelled bins. Watch for sarcasm. Target 87%.'
        this.controls = [{ label: '← POSITIVE · A', key: 'KeyA' }, { label: '↓ NEUTRAL · S', key: 'KeyS' }, { label: 'NEGATIVE · D →', key: 'KeyD' }]
        run.assets.arena(run, 'signal_noise')
        this.posts = run.assets.cards.filter(c => c.kind === 'post')
        this.card = run.assets.instances(run, 'mg_post_card', 1, this.posts[0].id)
        this.sorted = 0; this.correct = 0; this.sarcasmMisses = 0; this.timer = 0
        this.matrix = Array.from({ length: 3 }, () => [0, 0, 0])
        this.next()
    }
    next()
    {
        const list = this.sorted >= 25 && this.sorted % 3 === 0 ? this.posts.filter(p => p.sarcastic) : this.posts
        this.post = list[(this.sorted * 7 + 3) % list.length]
        this.card.card(this.post.id)
        this.timer = 0
        // Give visitors time to actually read a post, especially on a phone.
        this.window = Math.max(2, 3.5 - this.sorted * 0.03) * (this.run.world.config.reducedMotion ? 1 / 0.7 : 1)
        this.run.hud(`${this.correct}/${this.sorted} correct · ${this.sorted ? Math.round(this.correct / this.sorted * 100) : 100}% accuracy · target 87%`, this.post.text)
    }
    action(key)
    {
        const truth = ['KeyA', 'ArrowLeft'].includes(key) ? 'positive' : ['KeyD', 'ArrowRight'].includes(key) ? 'negative' : ['KeyS', 'ArrowDown'].includes(key) ? 'neutral' : null
        if(truth) this.sort(truth)
    }
    sort(choice)
    {
        const good = choice === this.post.truth
        if(good) this.correct++
        else if(this.post.sarcastic) this.sarcasmMisses++
        const bins = ['positive', 'neutral', 'negative']
        if(choice) this.matrix[bins.indexOf(this.post.truth)][bins.indexOf(choice)]++
        this.sorted++; this.run.cue(good)
        if(this.sorted === 50)
        {
            const medal = sentimentMedal(this.correct, 50, this.sarcasmMisses)
            this.run.finish(!!medal, `${this.correct}/50 correct (${this.correct * 2}%). Confusion matrix (+ / neutral / −): ${this.matrix.map(row => row.join('/')).join(' | ')}.`, medal)
        }
        else this.next()
    }
    update(dt)
    {
        this.timer += dt
        const progress = Math.min(1, this.timer / this.window)
        this.card.set(0, [0, 5 - progress * 7, 1.7 + Math.sin(progress * Math.PI) * 0.6], 1.5)
        this.card.commit(1)
        this.run.hud(`${this.correct}/${this.sorted} correct · ${this.sorted ? Math.round(this.correct / this.sorted * 100) : 100}% accuracy · ${Math.max(0, this.window - this.timer).toFixed(1)}s to sort`, this.post.text)
        if(this.timer > this.window) this.sort(null)
    }
    camera()
    {
        const portrait = this.run.world.camera.instance.aspect < 0.8
        this.run.cameraPosition.set(420, portrait ? 313.2 : 315, 1.8)
        this.run.cameraLook.set(420, 323, 1.6)
    }
    cameraFov(aspect) { return aspect < 0.8 ? Math.min(120, 2 * Math.atan(Math.tan(65 * Math.PI / 360) * 1.2 / aspect) * 180 / Math.PI) : 65 }
}
