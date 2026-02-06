import { Init_canvas, Loop } from 'twisterjs'
import { bridge_init, get_info, is_audio_enabled, set_audio_enabled_change_cb, set_is_paused_change_cb, set_is_visible_change_cb } from './bridge'
import './style.css'

import { _render, _update, _init, _set_ctx } from './game'

async function init_bridge() {

  await bridge_init()

  console.log(get_info())

  console.log(is_audio_enabled())

  set_audio_enabled_change_cb((yes) => {
    console.log(yes)
  })

  set_is_paused_change_cb((yes) => {

  })
}

async function app(el: HTMLElement) {

  let { batch, canvas } = Init_canvas(1920, 1080, el, _render)

  _set_ctx(batch, canvas)
  _init()

  Loop(_update, _render)

}


app(document.getElementById('app')!)