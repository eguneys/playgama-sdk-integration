import { RenderQueue } from "./RenderPass"
import { Renderer } from "./renderer"

export type InitCanvas = {
    queue: RenderQueue
    canvas: HTMLCanvasElement
    cleanup: () => void
}

/**
 * Creates a canvas, appends it to DOM, and sets up WebGL Batched Rendering with simple shapes
 * @param game_width Logical game width you will use when drawing
 * @param game_height Logical game height
 * @param container DOM element to append the Canvas to
 * @param _render your render function used to call it when resizing that avoids flicker, not essential, pass a dummy if you want
 * 
 * @returns ```
 * { 
 *    canvas: HTMLCanvasElement, 
 *    batch: BatchRenderer, 
 *    cleanup: () => void 
 * }
 * ```
 */
export function Init_canvas(game_width: number, game_height: number, container: HTMLElement, _render: () => void): InitCanvas {

    let canvas = document.createElement('canvas')
    canvas.classList.add('twisterjs-responsive-full')

    const resizeToContainer = () => {
        const dpr = window.devicePixelRatio || 1

        const rect = container.getBoundingClientRect()

        const targetWidth = Math.floor(rect.width * dpr)
        const targetHeight = Math.floor(rect.height * dpr)


        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {

            canvas.width = targetWidth
            canvas.height = targetHeight
            renderer.set_viewport(canvas.width, canvas.height)
            _render()
        }
    }



    const renderer = new Renderer(game_width, game_height, canvas)
    let queue = new RenderQueue(renderer.gl, renderer.width, renderer.height)

    const resizeObserver = new ResizeObserver(() => {
        resizeToContainer()
    })

    resizeObserver.observe(container)

    container.appendChild(canvas)

    return {
        canvas,
        queue,
        cleanup() {
            resizeObserver.unobserve(container)
        }
    }
}