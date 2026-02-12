import { Sprite } from '../twisterjs/webgl/Sprite'
import { TextureAtlas } from '../twisterjs/webgl/TextureAtlas'
import { SpriteRenderer } from '../twisterjs/webgl/SpriteRenderer'

export function _update(delta: number) {
    t += delta

    Vampire.vs.forEach(_ => _.update(delta))
    //sceneCamera.zoomAt(100, 100, 1 + Math.sin(t * 0.001) * 0.2)

    Occupancy.update(delta)

    Cursor.instance.update(delta)
}

enum TerrainType {
    Empty,
}

type Tile = {
    terrain: TerrainType
}

enum OccupancyState {
    OnTile,
    MovingIn,
    MovingOut,
    Spawn,
}

class Occupancy {

    static spawn_delay: Delay = new Delay().set_line('1000')

    static add_occ: Occupancy[] = []
    static remove_occ: Occupancy[] = []
    static os_by_state: Map<OccupancyState, Occupancy[]> = new Map()

    static get size() {
        return [...this.os_by_state.values()].reduce((a, b) => a + b.length, 0)
    }

    static spawn_if_empty = (coord: TileCord) => {

        let exists = Occupancy.os_by_state.get(OccupancyState.OnTile)?.find(_ => vec2_equals(_.coord, vec2(0, 0)))
        if (exists) {
            return
        }

        exists = Occupancy.os_by_state.get(OccupancyState.Spawn)?.find(_ => vec2_equals(_.coord, vec2(0, 0)))
        if (exists) {
            return
        }
        exists = Occupancy.os_by_state.get(OccupancyState.MovingOut)?.find(_ => vec2_equals(_.coord, vec2(0, 0)))
        if (exists) {
            return
        }




        Occupancy.add_occ.push(new Occupancy(
            Vampire.push(coord), 
            OccupancyState.Spawn, 
            coord, 
            0))
    }

    static move_if_empty = (occ: Occupancy, to_tile: TileCord) => {

        let exists = Occupancy.os_by_state.get(OccupancyState.OnTile)?.find(_ => vec2_equals(_.coord, to_tile))
        if (exists) {
            return
        }
        exists = Occupancy.os_by_state.get(OccupancyState.MovingIn)?.find(_ => vec2_equals(_.coord, to_tile))
        if (exists) {
            return
        }
        exists = Occupancy.os_by_state.get(OccupancyState.Spawn)?.find(_ => vec2_equals(_.coord, to_tile))
        if (exists) {
            return
        }




        occ.vampire.move_to(to_tile)
        Occupancy.remove_occ.push(occ)
        Occupancy.add_occ.push(new Occupancy(
            occ.vampire,
            OccupancyState.MovingIn,
            to_tile,
            occ.spiral_i
        ))
        Occupancy.add_occ.push(new Occupancy(
            occ.vampire,
            OccupancyState.MovingOut,
            occ.coord,
            occ.spiral_i
        ))
    }

    static remove = (occ: Occupancy) => {
        Occupancy.remove_occ.push(occ)
    }

    static move_in = (occ: Occupancy) => {
        Occupancy.remove(occ)
        Occupancy.add_occ.push(new Occupancy(
            occ.vampire,
            OccupancyState.OnTile,
            occ.coord,
            occ.spiral_i
        ))
    }

    static update = (delta: number) => {


        if (Occupancy.size < 90) {
            Occupancy.spawn_if_empty(vec2(0, 0))
        }

        this.remove_occ.forEach(_ => {
            let list = this.os_by_state.get(_.state)!
            this.os_by_state.set(_.state, list.filter(i => i !== _))
        })

        this.add_occ.forEach(_ => {
            let list = this.os_by_state.get(_.state) ?? []
            list.push(_)
            this.os_by_state.set(_.state, list)
        })


        this.add_occ = []
        this.remove_occ = []

        this.os_by_state.forEach(_ => _.map(_ => _.update(delta)))

        this.spawn_delay.update(delta)

    }

    time: number

    constructor(
        public vampire: Vampire,
        public state: OccupancyState,
        public coord: TileCord,
        public spiral_i: number
    ) {
        this.time = 0
    }


    update(delta: number) {
        this.time += delta

        switch (this.state) {
            case OccupancyState.Spawn: {
                this.move_if_empty()
            } break
            case OccupancyState.OnTile: {
                this.move_if_empty()
            } break
            case OccupancyState.MovingOut: {
                if (this.vampire.to_tile === undefined) {
                    Occupancy.remove(this)
                }
            } break
            case OccupancyState.MovingIn: {
                if (this.vampire.to_tile === undefined) {
                    Occupancy.move_in(this)
                }
            }
        }
    }



    private move_if_empty() {
        let occ = this
        let on_tile = occ.vampire.on_tile
        let to_tile = add(on_tile, vec2(1, 0))
        let spiral_i = occ.spiral_i

        if (on_tile.x === Grid.width - spiral_i) {
            // Right edge - go DOWN
            to_tile = vec2(on_tile.x, on_tile.y + 1)

            if (on_tile.y === Grid.height - spiral_i) {
                // Hit bottom-right corner - go LEFT instead
                to_tile = vec2(on_tile.x - 1, on_tile.y)
            }
        } else if (on_tile.y === Grid.height - spiral_i) {
            // Bottom edge - go LEFT
            to_tile = vec2(on_tile.x - 1, on_tile.y)

            if (on_tile.x - spiral_i < 1) {
                // Hit bottom-left corner - go UP instead
                to_tile = vec2(on_tile.x, on_tile.y - 1)
            }
        } else if (on_tile.x - spiral_i < 1) {
            // Left edge - go UP
            to_tile = vec2(on_tile.x, on_tile.y - 1)

            // You're missing the top-left corner case here
            if (on_tile.y - spiral_i < 1) {
                // Hit top-left corner - go RIGHT instead
                to_tile = vec2(on_tile.x + 1, on_tile.y)

            }
        } else if (on_tile.y - spiral_i < 1) {
            // Top edge - go RIGHT
            to_tile = vec2(on_tile.x + 1, on_tile.y)

        }

        if (to_tile.x === spiral_i && to_tile.y === (spiral_i + 1)) {
            occ.spiral_i += 1
        }

        Occupancy.move_if_empty(occ, to_tile)
    }

}

const empty_tile = () => ({ terrain: TerrainType.Empty })

class Grid {

    static tileSize = 16 
    static width = 16
    static height = 9
    static Speed = 1

    tiles: Tile[][]

    constructor() {

        this.tiles = []
        for (let i = 0; i < Grid.width; i++) {
            this.tiles[i] = []
            for (let j = 0; j < Grid.height; j++) {
                this.tiles[i][j] = empty_tile()
            }
        }
    }

}

type TileCord = Vec2

const tile_to_pos = (cord: TileCord) => add(mulScalar(cord, Grid.tileSize), vec2(9, 16))

class Vampire {
    static vs: Vampire[] = []

    static push = (on_tile: TileCord) => {
        let v = new Vampire(on_tile)
        Vampire.vs.push(v)
        return v
    }

    time: number

    to_tile?: TileCord
    to_delay: Delay

    get position() {
        return vec2(this.spring_position_x.value, this.spring_position_y.value)
    }

    spring_position_x: AnimChannel
    spring_position_y: AnimChannel

    a: AnimChannel
    a_delay: Delay

    constructor(public on_tile: TileCord) {
        this.time = 0
        let position = tile_to_pos(on_tile)
        this.spring_position_x = new AnimChannel(position.x)
        this.spring_position_y = new AnimChannel(position.y)
        this.to_delay = new Delay()
        this.a = new AnimChannel(0)
        this.a.springTo(60)
        this.a_delay = new Delay().set_line('300')
    }

    move_to(to_tile: TileCord) {
        this.to_tile = to_tile
        let to_position = tile_to_pos(to_tile)
        this.spring_position_x.springTo(to_position.x)
        this.spring_position_y.springTo(to_position.y)
        this.to_delay.set_line('500')
    }

    update(delta: number) {
        this.time += delta

        if (this.to_delay.action === 'end') {
            this.on_tile = this.to_tile!
            this.to_tile = undefined
        }

        if (this.a_delay.action === 'end') {
            this.a.springTo(40)
        }

        this.to_delay.update(delta)
        this.spring_position_x.update(delta / 1000)
        this.spring_position_y.update(delta / 1000)
        this.a.update(delta / 1000)
        this.a_delay.update(delta)
    }

    render() {

        let { x, y } = this.position

        queue.submit({
            type: 'sprite',
            pass: 'world',
            sprite: vSprite,
            x,
            y,
            layer: 0,
            depth: 0
        })

        pipeline.lights.push({
            atlasIndex: 0,
            position: this.position,
            radius: this.a.value,
            color: colors.darkblue,
            time: this.time * 0.0001
        })
    }
}


export function _render() {

    if (t === undefined) {
        return
    }


    queue.submit({
        type: 'sprite',
        pass: 'world',
        sprite: bgSprite,
        x: 0,
        y: 0,
        scale: 8,
        layer: 0,
        depth: 0
    })


    Vampire.vs.forEach(_ => _.render())

    Cursor.instance.render()
    pipeline.render()
}




import bg_test from '../design/bg_test.png'
import test_pgn from '../design/test2.png'
import type { Camera2D } from '../twisterjs/webgl/camera2d'
import { add, AnimChannel, BloomPass, colors, Delay, DragHandler, FullscreenQuadRenderer, load_image, mulScalar, vec2, vec2_equals, vibrant, type RenderQueue, type Vec2} from '../twisterjs'
import { RenderPipeline } from './pipeline'

let drag: DragHandler
export async function _set_ctx(q: RenderQueue, canvas: HTMLCanvasElement) {
    queue = q

    drag = DragHandler(320, 180, canvas)

    let bg_image = await load_image(bg_test)

    let atlas_image = await load_image(test_pgn)

    bg_atlas = TextureAtlas.fromImageAndJSON(queue.gl, bg_image, {
        frames: {
            'bg1': { frame: { x: 0, y: 0, w: 500, h: 500 } },
        }
    })
 
    // @ts-ignore
    const frames = (key: string, frame: { x: number, y: number, w: number, h: number}, l: number) => {

        let res: any = {}

        for (let i = 0; i < l; i++) {
            res[`${key}_${i}`] = { frame: { x: frame.x + i * frame.w, y: frame.y, w: frame.w, h: frame.h }}
        }

        return res
    }

 
    // @ts-ignore
    const sprites = (key: string, atlas: TextureAtlas, l: number) => {
        let res = []

        for (let i = 0; i < l; i++) {
            res.push(new Sprite(atlas, `${key}_${i}`))
        }

        return res
    }

    atlas = TextureAtlas.fromImageAndJSON(queue.gl, atlas_image, {
        frames: {
            //...frames('player_idle', { x: 0, y: 0, w: 32, h: 32 }, 4),
            //...frames('test_idle', { x: 0, y: 100, w: 100, h: 100 }, 1),
            'player_idle': { frame: { x: 24, y: 0, w: 8, h: 8 }},
            'cursor': { frame: { x: 0, y: 16, w: 16, h: 16 }}
        }
    }, { pixelArt: true })

    vSprite = new Sprite(atlas, 'player_idle')
    cursor_Sprite = new Sprite(atlas, 'cursor')

    bgSprite = new Sprite(bg_atlas, 'bg1')

    pipeline = new RenderPipeline(queue, 320, 180)

    pipeline.scenePass.addRenderer(new SpriteRenderer(q.gl, bg_atlas))
    pipeline.scenePass.addRenderer(new SpriteRenderer(q.gl, atlas))

    pipeline.wallsPass.addRenderer(new SpriteRenderer(q.gl, bg_atlas))
    pipeline.wallsPass.addRenderer(new SpriteRenderer(q.gl, atlas))

    pipeline.bloomPass = new BloomPass(queue.gl, new FullscreenQuadRenderer(queue.gl), 320, 180)

    sceneCamera = pipeline.scenePass.camera
}

let cursor_Sprite: Sprite
let vSprite: Sprite

let queue: RenderQueue

let sceneCamera: Camera2D
let atlas: TextureAtlas
let bg_atlas: TextureAtlas


let bgSprite: Sprite

let pipeline: RenderPipeline

let t: number

class Cursor {

    static instance = new Cursor()

    position: Vec2
    position_d0: [AnimChannel, AnimChannel]
    position_d1: [AnimChannel, AnimChannel]
    lag: Delay

    private constructor() {
        this.position = vec2(0, 0)
        this.position_d0 = [new AnimChannel(), new AnimChannel()]
        this.position_d1 = [new AnimChannel(), new AnimChannel()]

        this.lag = new Delay().set_line(200)
    }

    update(delta: number) {
        this.position = vec2(drag.is_hovering[0], drag.is_hovering[1])

        this.lag.update(delta)

        if (this.lag.action === 'end') {
            this.position_d1[0].springTo(this.position_d0[0].value)
            this.position_d1[1].springTo(this.position_d0[1].value)

            this.position_d0[0].springTo(this.position.x)
            this.position_d0[1].springTo(this.position.y)

            this.lag.set_line(10 + Math.random() * 60)
        }

        this.position_d0[0].update(delta / 1000)
        this.position_d0[1].update(delta / 1000)
        this.position_d1[0].update(delta / 1000)
        this.position_d1[1].update(delta / 1000)
    }

    render() {
        pipeline.lights.push({
            atlasIndex: 0,
            position: this.position,
            radius: 30,
            color: vibrant.red,
            time: t * 0.02
        })

        pipeline.lights.push({
            atlasIndex: 0,
            position: vec2(this.position_d0[0].value, this.position_d0[1].value),
            radius: 30,
            color: colors.darkblue,
            time: t * 0.02
        })

        pipeline.lights.push({
            atlasIndex: 0,
            position: vec2(this.position_d1[0].value, this.position_d1[1].value),
            radius: 20,
            color: colors.darkred,
            time: t * 0.02
        })

        queue.submit({
            type: 'sprite',
            pass: 'world',
            sprite: cursor_Sprite,
            x: this.position.x,
            y: this.position.y,
            layer: 0,
            depth: 0
        })


    }
}



export function _init() {
    sceneCamera.setOrthographic(0, 320, 180, 0)

    t = 0 
}

