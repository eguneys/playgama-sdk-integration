import { colors, type BatchRenderer, DragHandler, type Vec2, vec2, vibrant, AnimChannel, Delay, type SpringConfig } from 'twisterjs'

let t: number
let cursor: Vec2
let sc: AnimChannel
let d: Delay

export function _init() {
    t = 0
    cursor = vec2(0, 0)

    sc = new AnimChannel(0)
    d = new Delay()
}

const HighSpring: SpringConfig = { stiffness: 800, damping: 10 }
const LowSpring: SpringConfig = { stiffness: 100, damping: 8 }

export function _update(delta: number) {
    t += delta

    cursor = vec2(drag.is_hovering[0], drag.is_hovering[1])

    if (drag.is_just_down) {
        d.set_line('200')
        sc.springTo(10, HighSpring)
    }

    if (d.action === 'end') {
        sc.springTo(0, LowSpring)
    }

    d.update(delta)
    sc.update(delta / 1000)
    drag.update(delta)
}

export function _render() {

    batch.beginFrame()
    batch.fillRect(1920/2, 1080/2, 1920, 1080, vibrant.darkblue)

    background()


    batch.strokeLine(cursor.x - 15, cursor.y - 15, cursor.x + 15, cursor.y + 15, 8, colors.white)
    batch.strokeLine(cursor.x, cursor.y, cursor.x + 15, cursor.y + 15, 18, colors.white)

    batch.endFrame()
}

function background() {
    let s = sc.value
    batch.pushMask()
    batch.fillRect(cursor.x, cursor.y, 100 - s, 100 - s, colors.white, 0 + Math.PI * 0.125)
    batch.fillRect(cursor.x, cursor.y, 100 - s, 100 - s, colors.white, Math.PI * 0.25 + Math.PI * 0.125)
    //batch.fillRect(1920/ 2, 1080/2, 1920, 1080, colors.white)
    batch.endMask()

    batch.fillRect(1920/ 2, 1080/2, 1920, 1080, colors.blue)


    batch.popMask()
}

export function _set_ctx(b: BatchRenderer, canvas: HTMLCanvasElement) {
    batch = b

    drag = DragHandler(1920, 1080, canvas)
}

let batch: BatchRenderer
let drag: DragHandler


