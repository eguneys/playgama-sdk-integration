export type DemoReturn = {
  canvas: HTMLCanvasElement,
  cleanup: () => void
}

export type RenderFn = (el: HTMLElement) => Promise<DemoReturn>

export type AppendAsyncGameToDomManager = {
  on_new_renderFn(renderFn: RenderFn): void
  on_destroy(): void
}

/**
 * A Manager to help manage appending your game canvas 
 * to the webpage safely so that it cleans up after it.
 * The canvas is obtained asynchronously through `on_new_renderFn` callback
 * and can be called multiple times safely because the cleanup will happen accordingly.
 * 
 * @returns Two callbacks you have to call to pass the canvas, and to destroy on cleanup
 * ```
 * { on_new_renderFn, on_destroy }
 * ```
 * 
 * @example
 * 
 * ```
 *   const renderFn = async () => {
 *     let { canvas } = Init_canvas(...)
 * 
 *     // load your game
 * 
 *     const cleanup = () => {
 *        // your cleanup logic here
 *     }
 * 
 *     return {
 *       canvas,
 *       cleanup
 *     }
 *   }
 * 
 *   /* Sample Demonstration through SolidJS API
 *   onMount(() => {
 *       let { on_new_renderFn, on_destroy }= AppendAsyncGameToDomManager(el)
 *
 *       createEffect(() => {
 *         // renderFn could be a reactive property
 *         // so that on_new_renderFn gets called on every change
 *         // it's safe because cleanup will happen accordingly
 *         on_new_renderFn(renderFn)
 *       })
 *
 *       onCleanup(() => {
 *         on_destroy()
 *       })
 *   })
 * ```
 * 
 */
export function AppendAsyncGameToDomManager(el: HTMLElement): AppendAsyncGameToDomManager {

  const on_new_renderFn = (renderFn: RenderFn) => {
    replace_canvas(renderFn)
  }

  const on_destroy = () => {
    if (previous_demo) {
      el.removeChild(previous_demo.canvas)
      previous_demo.cleanup()
      previous_demo = undefined
    }
    destroyed = true

  }

  let res: AppendAsyncGameToDomManager = {
    on_new_renderFn,
    on_destroy
  }

  let destroyed = false

  let latest_render_fn: RenderFn | undefined
  let loading_render_fn = false
  let previous_demo: DemoReturn | undefined = undefined
  const replace_canvas = async (renderFn: RenderFn) => {

    latest_render_fn = renderFn

    if (loading_render_fn) {
      return
    }

    if (previous_demo) {
      el.removeChild(previous_demo.canvas)
      previous_demo.cleanup()
      previous_demo = undefined
    }

    loading_render_fn = true
    let render_fn = latest_render_fn
    previous_demo = await render_fn(el)

    if (destroyed) {
      previous_demo.cleanup()
      previous_demo = undefined
      return
    }


    loading_render_fn = false

    if (latest_render_fn !== render_fn) {
      replace_canvas(latest_render_fn)
    }
  }

  return res
}