import { CompositePass, FinalPass, MultiplyPass, RenderQueue, RenderTarget, ScenePass, type BloomPass } from "../twisterjs";
import { LightAtlas, LightAtlasPass, LightCompositePass, LightPlacementRenderer, LightRenderer, ShadowRenderer, type Light, type OccluderEdge } from "../twisterjs/webgl/light";
import { CameraUBO } from '../twisterjs/webgl/camera_ubo'
import { PixelPerfectCamera2D } from '../twisterjs/webgl/pixel_perfect_camera'

export class RenderPipeline {


    public readonly cameraUBO: CameraUBO
    public readonly camera: PixelPerfectCamera2D

    private sceneTarget: RenderTarget;
    private lightAtlas: LightAtlas;
    private lightAccumTarget: RenderTarget;
    private litSceneTarget: RenderTarget;
    private litWallTarget: RenderTarget;
    private compositedTarget: RenderTarget;


    private shapesTarget: RenderTarget;
    private finalHDTarget: RenderTarget;

    private lightAtlasPass: LightAtlasPass;
    private lightCompositePass: LightCompositePass;
    private multiplyPass: MultiplyPass;

    public bloomPass?: BloomPass;

    private compositePass: CompositePass
    private finalPass: FinalPass;

    // dynamic per frame
    public lights: Light[] = [];
    public occluders: OccluderEdge[] = [];

    public scenePass: ScenePass

    public wallsPass: ScenePass

    public shapesPass: ScenePass

    constructor(private queue: RenderQueue, width: number, height: number) {

        this.camera = new PixelPerfectCamera2D(width, height)
        this.cameraUBO = new CameraUBO(queue.gl)

        this.queue = queue
        let { gl } = queue
        // --- Targets ---
        this.sceneTarget = new RenderTarget(gl, width, height);
        this.lightAccumTarget = new RenderTarget(gl, width, height);
        this.litSceneTarget = new RenderTarget(gl, width, height);

        this.litWallTarget = new RenderTarget(gl, width, height)
        this.compositedTarget = new RenderTarget(gl, width, height)


        this.shapesTarget = new RenderTarget(gl, 1920, 1080)
        this.finalHDTarget = new RenderTarget(gl, 1920, 1080)

        this.lightAtlas = new LightAtlas(gl, 2048, 256);

        // --- Passes ---
        this.scenePass = queue.addPass('world', { target: this.sceneTarget })

        this.wallsPass = queue.addPass('walls', { target: this.litWallTarget, })

        this.shapesPass = queue.addPass('shapes', { target: this.shapesTarget, })

        this.compositePass = new CompositePass(gl)

        this.lightAtlasPass = new LightAtlasPass(
            gl,
            this.lightAtlas,
            new LightRenderer(gl),
            new ShadowRenderer(gl)
        );

        this.lightCompositePass = new LightCompositePass(
            gl,
            this.lightAtlas,
            new LightPlacementRenderer(gl),
            this.lightAccumTarget
        );

        this.multiplyPass = new MultiplyPass(
            gl,
            this.sceneTarget.texture,
            this.lightAccumTarget.texture,
            this.litSceneTarget
        );

        this.finalPass = new FinalPass(gl);
    }

    render() {

        this.camera.update()
        this.cameraUBO.update(this.camera.getMatrix4())

        // -------------------------
        // 1️⃣ Scene pass
        // -------------------------
        this.queue.flush()

        /*
        this.finalPass.execute(
            this.sceneTarget.texture
        );

        this.lights.length = 0
        return
        */


        // -------------------------
        // 2️⃣ Build Light Atlas
        // -------------------------
        this.lightAtlasPass.execute(
            this.lights,
            this.occluders
        );


        // -------------------------
        // 3️⃣ Place Lights Into World
        // -------------------------
        this.lightCompositePass.execute(
            this.lights
        );

        // -------------------------
        // 4️⃣ Multiply Scene × Light
        // -------------------------
        this.multiplyPass.execute();

        let nextTexture = this.litSceneTarget.texture
        // -------------------------
        // 5️⃣ Optional Bloom
        // -------------------------
        if (this.bloomPass) {
            nextTexture = this.bloomPass.execute(this.litSceneTarget.texture);
        }

        this.compositePass.execute(nextTexture, this.litWallTarget.texture, this.compositedTarget)

        this.compositePass.execute(this.compositedTarget.texture, this.shapesTarget.texture, this.finalHDTarget)

        // -------------------------
        // 6️⃣ Final To Screen
        // -------------------------
        this.finalPass.execute(
            this.finalHDTarget.texture
        );

        // Reset per-frame lists
        this.lights.length = 0;
        this.occluders.length = 0;
    }

}
