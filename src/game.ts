import { colors, type BatchRenderer } from 'twisterjs'

export function _update(delta: number) {

}

export function _set_ctx(_: BatchRenderer) {
    batch = _
}

let batch: BatchRenderer

export function _init() {
}

export function _render() {

    batch.beginFrame()
    batch.fillRect(1920/2, 1080/2, 1920, 1080, colors.darkblue)



    batch.endFrame()
}

