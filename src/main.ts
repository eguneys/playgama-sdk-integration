import { Init_canvas, Loop } from '../twisterjs'
import { bridge_init, get_info, is_audio_enabled, set_audio_enabled_change_cb, set_is_paused_change_cb } from './bridge'
import './style.css'

import { _render, _update, _init, _set_ctx } from './game'

export async function init_bridge() {

  await bridge_init()

  console.log(get_info())

  console.log(is_audio_enabled())

  set_audio_enabled_change_cb((yes) => {
    console.log(yes)
  })

  set_is_paused_change_cb((yes) => {
    console.log(yes)
  })
}

async function app(el: HTMLElement) {

  let { queue, canvas } = Init_canvas(1920, 1080, el, _render)

  await _set_ctx(queue, canvas)

  _init()

  Loop(_update, _render)

}


app(document.getElementById('app')!)