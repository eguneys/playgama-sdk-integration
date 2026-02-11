import { colors as pico_colors, vibrant as vibrant_colors, invaders as invader_colors } from './pico_colors'
import { Color } from './webgl/color'

export const colors = {
    black: Color.fromHexString(pico_colors.black)!,
    darkblue: Color.fromHexString(pico_colors.darkblue)!,
    darkred: Color.fromHexString(pico_colors.darkred)!,
    darkgreen: Color.fromHexString(pico_colors.darkgreen)!,
    brown: Color.fromHexString(pico_colors.brown)!,
    gray: Color.fromHexString(pico_colors.gray)!,
    lightgray: Color.fromHexString(pico_colors.lightgray)!,
    white: Color.fromHexString(pico_colors.white)!,
    red: Color.fromHexString(pico_colors.red)!,
    orange: Color.fromHexString(pico_colors.orange)!,
    yellow: Color.fromHexString(pico_colors.yellow)!,
    green: Color.fromHexString(pico_colors.green)!,
    blue: Color.fromHexString(pico_colors.blue)!,
    purple: Color.fromHexString(pico_colors.purple)!,
    pink: Color.fromHexString(pico_colors.pink)!,
    sand: Color.fromHexString(pico_colors.sand)!,
}

/* https://lospec.com/palette-list/cromatica */
export const vibrant = {
    white: Color.fromHexString(vibrant_colors.white)!,
    light: Color.fromHexString(vibrant_colors.light)!,
    blue: Color.fromHexString(vibrant_colors.blue)!,
    darkblue: Color.fromHexString(vibrant_colors.darkblue)!,
    black: Color.fromHexString(vibrant_colors.black)!,
    purple: Color.fromHexString(vibrant_colors.purple)!,
    red: Color.fromHexString(vibrant_colors.red)!,
    pink: Color.fromHexString(vibrant_colors.pink)!,
    yellow: Color.fromHexString(vibrant_colors.yellow)!,
    green: Color.fromHexString(vibrant_colors.green)
}



export const invaders = {
    sand1: Color.fromHexString(invader_colors.sand1)!,
    sand2: Color.fromHexString(invader_colors.sand2)!,
    sand3: Color.fromHexString(invader_colors.sand3)!,
    sand4: Color.fromHexString(invader_colors.sand4)!,
    sand5: Color.fromHexString(invader_colors.sand5)!,
    orange1: Color.fromHexString(invader_colors.orange1)!,
    orange2: Color.fromHexString(invader_colors.orange2)!,
    orange3: Color.fromHexString(invader_colors.orange3)!,
    red1: Color.fromHexString(invader_colors.red1)!,
    red2: Color.fromHexString(invader_colors.red2)!,
    red3: Color.fromHexString(invader_colors.red3)!,
    red4: Color.fromHexString(invader_colors.red4)!,
    purple1: Color.fromHexString(invader_colors.purple1)!,
    purple2: Color.fromHexString(invader_colors.purple2)!,
    purple3: Color.fromHexString(invader_colors.purple3)!,
    purple4: Color.fromHexString(invader_colors.purple4)!,
    blue1: Color.fromHexString(invader_colors.blue1)!,
    blue2: Color.fromHexString(invader_colors.blue2)!,
    blue3: Color.fromHexString(invader_colors.blue3)!,
    blue4: Color.fromHexString(invader_colors.blue4)!,
    green1: Color.fromHexString(invader_colors.green1)!,
    green2: Color.fromHexString(invader_colors.green2)!,
    green3: Color.fromHexString(invader_colors.green3)!,
    green4: Color.fromHexString(invader_colors.green4)!,
    green5: Color.fromHexString(invader_colors.green5)!,
    lime1: Color.fromHexString(invader_colors.lime1)!,
    lime2: Color.fromHexString(invader_colors.lime2)!,
    lime3: Color.fromHexString(invader_colors.lime3)!,
    mor1: Color.fromHexString(invader_colors.mor1)!,
    mor2: Color.fromHexString(invader_colors.mor2)!,
    mor3: Color.fromHexString(invader_colors.mor3)!,
    mor4: Color.fromHexString(invader_colors.mor4)!,
}