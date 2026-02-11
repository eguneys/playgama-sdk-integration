import { Sprite } from './Sprite'

export class Animation {

    frames: Sprite[];
    frameDuration: number; // seconds
    loop: boolean;

    constructor(
        frames: Sprite[],
        frameDuration: number,
        loop = true
    ) {
        this.frames = frames;
        this.frameDuration = frameDuration;
        this.loop = loop;
    }

    getFrame(time: number): Sprite {

        const totalDuration =
            this.frames.length * this.frameDuration;

        if (this.loop)
            time = time % totalDuration;

        const index =
            Math.floor(time / this.frameDuration);

        return this.frames[
            Math.min(index, this.frames.length - 1)
        ];
    }
}


export class Animator {

    private current?: Animation;
    private time = 0;
    public speed = 1;

    play(animation: Animation) {
        if (this.current !== animation) {
            this.current = animation;
            this.time = 0;
        }
    }

    update(dt: number) {
        if (!this.current) return;
        this.time += dt * this.speed;
    }

    getCurrentSprite(): Sprite | null {
        if (!this.current) return null;
        return this.current.getFrame(this.time);
    }
}
