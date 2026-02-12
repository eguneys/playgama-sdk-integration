import { Sprite } from '../twisterjs/webgl/Sprite'
import { TextureAtlas } from '../twisterjs/webgl/TextureAtlas'
import { SpriteRenderer } from '../twisterjs/webgl/SpriteRenderer'

export function _update(delta: number) {
    t += delta

    Vampire.vs.forEach(_ => _.update(delta))
    //sceneCamera.zoomAt(100, 100, 1 + Math.sin(t * 0.001) * 0.2)

    grid_step_delay.update(delta)


    if (grid_step_delay.action === 'end') {
        grid_step_delay.set_line('2000')
        grid.step()
    }
}
export function _render_old() {

    let x = 100 + Math.sin(t * 0.003) * 80
    let lt = t * 0.0008

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
        },
        time: lt
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
        },
        time: lt
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
            },
            time: lt
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
 

    pipeline.render()

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
    SpawnCool
}

class Occupancy {

    static add_occ: Occupancy[] = []
    static remove_occ: Occupancy[] = []
    static os_by_state: Map<OccupancyState, Occupancy[]> = new Map()

    static spawn = (coord: TileCord) => {
        Occupancy.add_occ.push(new Occupancy(
            Vampire.push(coord), 
            OccupancyState.Spawn, 
            coord))
    }

    static move = (occ: Occupancy, to_tile: TileCord) => {
        occ.vampire.move_to(to_tile)
        Occupancy.remove_occ.push(occ)
        Occupancy.add_occ.push(new Occupancy(
            occ.vampire,
            OccupancyState.MovingIn,
            to_tile,
        ))
        Occupancy.add_occ.push(new Occupancy(
            occ.vampire,
            OccupancyState.MovingOut,
            occ.coord,
        ))
    }

    static update = (delta: number) => {
        this.os_by_state.forEach(_ => _.map(_ => _.update(delta)))
    }

    time: number

    constructor(
        public vampire: Vampire,
        public state: OccupancyState,
        public coord: TileCord,
    ) {
        this.time = 0
    }


    update(delta: number) {
        this.time += delta

        switch (this.state) {
            case OccupancyState.Spawn: {
                this.move()
            }
        }
    }



    private move() {
        let occ = this
        let on_tile = occ.vampire.on_tile
        let to_tile = add(on_tile, vec2(1, 0))
        if (on_tile.x === Grid.width - 1) {
            to_tile = vec2(on_tile.x, on_tile.y + 1)

            if (on_tile.y === Grid.height - 1) {
                to_tile = vec2(on_tile.x - 1, on_tile.y)
            }
        }

        Occupancy.move(occ, to_tile)
    }



}

const empty_tile = () => ({ terrain: TerrainType.Empty })

class Grid {

    static tileSize = 24
    static width = 8
    static height = 8

    tiles: Tile[][]

    constructor() {

        this.tiles = []
        for (let i = 0; i < Grid.width; i++) {
            this.tiles[i] = []
            for (let j = 0; j < Grid.height; j++) {
                this.tiles[i][j] = empty_tile()
            }
        }

        this.step()

    }


    step() {

        let remove_occ = []
        let add_occ = []

        for (let occ of this.occupancy) {

            if (occ.state === OccupancyState.OnTile) {
                this.move_vampire(occ, add_occ, remove_occ)

            }

            if (occ.state === OccupancyState.MovingOut) {

                if (occ.vampire.to_tile === undefined) {
                    remove_occ.push(occ)
                }
            }

            if (occ.state === OccupancyState.MovingIn) {
                remove_occ.push(occ)
                add_occ.push({
                    state: OccupancyState.OnTile,
                    vampire: occ.vampire,
                    coord: occ.coord
                })
            }

            if (occ.state === OccupancyState.Spawn) {
                this.move_vampire(occ, add_occ, remove_occ)
            }

            if (occ.state === OccupancyState.SpawnCool) {
                this.spawn_vampire(vec2(0, 0), add_occ)
                remove_occ.push(occ)
            }
        }

        this.occupancy = this.occupancy.filter(_ => remove_occ.indexOf(_) === -1)

        if (this.occupancy.length === 0) {
            this.spawn_vampire(vec2(0, 0), add_occ)
        }

        this.occupancy.push(...add_occ)

    }

    private spawn_vampire(on_tile: TileCord, add_occ: Occupancy[]) {

        let vampire = Vampire.push(on_tile)

        add_occ.push({
            vampire,
            state: OccupancyState.Spawn,
            coord: on_tile
        })


        add_occ.push({
            vampire,
            state: OccupancyState.SpawnCool,
            coord: on_tile
        })
    }
}

type TileCord = Vec2

const tile_to_pos = (cord: TileCord) => add(mulScalar(cord, Grid.tileSize), vec2(10, 10))

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
        this.a.springTo(100)
        this.a_delay = new Delay().set_line('300')
    }

    move_to(to_tile: TileCord) {
        this.to_tile = to_tile
        let to_position = tile_to_pos(to_tile)
        this.spring_position_x.springTo(to_position.x)
        this.spring_position_y.springTo(to_position.y)
        this.to_delay.set_line('100')
    }

    update(delta: number) {
        this.time += delta

        if (this.to_delay.action === 'end') {
            this.on_tile = this.to_tile!
            this.to_tile = undefined
        }

        if (this.a_delay.action === 'end') {
            this.a.springTo(80)
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
            color: colors.blue,
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
        layer: 0,
        depth: 0
    })


    Vampire.vs.forEach(_ => _.render())


    pipeline.render()
}




import bg_test from '../design/bg_test.png'
import test_pgn from '../design/test2.png'
import type { Camera2D } from '../twisterjs/webgl/camera2d'
import { add, AnimChannel, BloomPass, colors, Delay, FullscreenQuadRenderer, load_image, mulScalar, vec2, type RenderQueue, type Vec2} from '../twisterjs'
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
            'player_idle': { frame: { x: 0, y: 0, w: 32, h: 32 }}
        }
    }, { pixelArt: true })

    vSprite = new Sprite(atlas, 'player_idle')

    bgSprite = new Sprite(bg_atlas, 'bg1')

    pipeline = new RenderPipeline(queue, 320, 180)

    pipeline.scenePass.addRenderer(new SpriteRenderer(q.gl, bg_atlas))
    pipeline.scenePass.addRenderer(new SpriteRenderer(q.gl, atlas))

    pipeline.wallsPass.addRenderer(new SpriteRenderer(q.gl, bg_atlas))
    pipeline.wallsPass.addRenderer(new SpriteRenderer(q.gl, atlas))

    pipeline.bloomPass = new BloomPass(queue.gl, new FullscreenQuadRenderer(queue.gl), 320, 180)

    sceneCamera = pipeline.scenePass.camera
}

let vSprite: Sprite

let queue: RenderQueue

let sceneCamera: Camera2D
let atlas: TextureAtlas
let bg_atlas: TextureAtlas


let bgSprite: Sprite

let pipeline: RenderPipeline

let grid: Grid
let t: number

let grid_step_delay: Delay
export function _init() {
    sceneCamera.setOrthographic(0, 320, 180, 0)

    t = 0 

    grid = new Grid()
    grid_step_delay = new Delay().set_line('200')
}

