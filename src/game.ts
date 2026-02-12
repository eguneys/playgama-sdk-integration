import { Sprite } from '../twisterjs/webgl/Sprite'
import { TextureAtlas } from '../twisterjs/webgl/TextureAtlas'
import { Animator, Animation } from '../twisterjs/webgl/animation'
import { SpriteRenderer } from '../twisterjs/webgl/SpriteRenderer'

export function _update(delta: number) {
    t += delta

    animator.update(delta)
    testAnimator.update(delta)

    sceneCamera.zoomAt(100, 100, 1 + Math.sin(t * 0.001) * 0.2)

}

export function _render() {

    if (animator === undefined) {
        return
    }

    let x = 100 + Math.sin(t * 0.003) * 80

    pipeline.lights.push({
        atlasIndex: -1,
        position: {
            x: 0,
            y: 0
        },
        radius: 100,
        color: {
            r: 1.0,
            g: 0.0,
            b: 1.0
        }
    })
    pipeline.lights.push({
        atlasIndex: -1,
        position: {
            x: 100,
            y: 100
        },
        radius: 100,
        color: {
            r: 1.0,
            g: 0.0,
            b: 1.0
        }
    })



    pipeline.occluders.push({
        a: vec2(0, 0), b: vec2(200, 0)
    })
    pipeline.occluders.push({
        a: vec2(50, 100), b: vec2(50, 200)
    })



    for (let i = 0; i < 8; i++) {

        pipeline.lights.push({
            atlasIndex: -1,
            position: {
                x,
                y: 100
            },
            radius: 80,
            color: {
                r: 1.0,
                g: 1.0,
                b: 1.0
            }
        })
    }

    queue.submit({
        type: 'sprite',
        pass: 'world',
        sprite: bgSprite,
        x: 200,
        y: 200,
        rotation: 0,
        layer: 0,
        depth: 0,
    })
 
    let sprite = animator.getCurrentSprite()



    queue.submit({
        type: 'sprite',
        pass: 'walls',
        sprite: sprite,
        x: 50,
        y: 100,
        rotation: 0,
        layer: 0,
        depth: 0,
    })


    queue.submit({
        type: 'sprite',
        pass: 'world',
        sprite,
        x,
        y: 100,
        rotation: 0,
        layer: 0,
        depth: 0,
    })


    sprite = testAnimator.getCurrentSprite()

    queue.submit({
        type: 'sprite',
        pass: 'world',
        sprite,
        x: 1500,
        y: 500,
        rotation: 0,
        layer: 0,
        depth: 0,
    })




    pipeline.render()

}


import bg_test from '../design/bg_test.png'
import test_pgn from '../design/test2.png'
import type { Camera2D } from '../twisterjs/webgl/camera2d'
import { BloomPass, FullscreenQuadRenderer, load_image, vec2, type RenderQueue } from '../twisterjs'
import { RenderPipeline } from './pipeline'

export async function _set_ctx(q: RenderQueue, _canvas: HTMLCanvasElement) {
    queue = q

    let bg_image = await load_image(bg_test)

    let atlas_image = await load_image(test_pgn)

    bg_atlas = TextureAtlas.fromImageAndJSON(queue.gl, bg_image, {
        frames: {
            'bg1': { frame: { x: 0, y: 0, w: 500, h: 500 } },
        }
    })
 
    const frames = (key: string, frame: { x: number, y: number, w: number, h: number}, l: number) => {

        let res: any = {}

        for (let i = 0; i < l; i++) {
            res[`${key}_${i}`] = { frame: { x: frame.x + i * frame.w, y: frame.y, w: frame.w, h: frame.h }}
        }

        return res
    }


    const sprites = (key: string, atlas: TextureAtlas, l: number) => {
        let res = []

        for (let i = 0; i < l; i++) {
            res.push(new Sprite(atlas, `${key}_${i}`))
        }

        return res
    }

    atlas = TextureAtlas.fromImageAndJSON(queue.gl, atlas_image, {
        frames: {
            ...frames('player_idle', { x: 0, y: 0, w: 100, h: 100 }, 4),
            ...frames('test_idle', { x: 0, y: 100, w: 100, h: 100 }, 1),
        }
    }, { pixelArt: true })

    playerAnimation = new Animation(sprites('player_idle', atlas, 4), 200, true)
    testAnimation = new Animation(sprites('test_idle', atlas, 1), 200, true)

    bgSprite = new Sprite(bg_atlas, 'bg1')

    pipeline = new RenderPipeline(queue, 320, 180)

    pipeline.scenePass.addRenderer(new SpriteRenderer(q.gl, bg_atlas))
    pipeline.scenePass.addRenderer(new SpriteRenderer(q.gl, atlas))

    pipeline.wallsPass.addRenderer(new SpriteRenderer(q.gl, bg_atlas))
    pipeline.wallsPass.addRenderer(new SpriteRenderer(q.gl, atlas))

    pipeline.bloomPass = new BloomPass(queue.gl, new FullscreenQuadRenderer(queue.gl), 320, 180)

    sceneCamera = pipeline.scenePass.camera
}

let queue: RenderQueue

let sceneCamera: Camera2D
let atlas: TextureAtlas
let bg_atlas: TextureAtlas


let bgSprite: Sprite

let animator: Animator
let testAnimator: Animator

let playerAnimation: Animation
let testAnimation: Animation


let pipeline: RenderPipeline

let t: number
export function _init() {
    sceneCamera.setOrthographic(0, 320, 180, 0)

    t = 0 

    animator = new Animator()
    animator.play(playerAnimation)

    testAnimator = new Animator()
    testAnimator.play(testAnimation)
}

