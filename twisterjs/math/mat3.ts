export class Mat3 {

    data = new Float32Array(9);

    constructor() {
        this.identity();
    }

    identity() {
        const m = this.data;
        m[0] = 1; m[3] = 0; m[6] = 0;
        m[1] = 0; m[4] = 1; m[7] = 0;
        m[2] = 0; m[5] = 0; m[8] = 1;
        return this;
    }

    translate(x: number, y: number) {
        const m = this.data;
        m[6] += x;
        m[7] += y;
        return this;
    }

    scale(x: number, y: number) {
        const m = this.data;
        m[0] *= x;
        m[4] *= y;
        return this;
    }

    multiply(b: Mat3) {
        const a = this.data;
        const c = new Float32Array(9);
        const d = b.data;

        c[0] = a[0]*d[0] + a[3]*d[1] + a[6]*d[2];
        c[1] = a[1]*d[0] + a[4]*d[1] + a[7]*d[2];
        c[2] = a[2]*d[0] + a[5]*d[1] + a[8]*d[2];

        c[3] = a[0]*d[3] + a[3]*d[4] + a[6]*d[5];
        c[4] = a[1]*d[3] + a[4]*d[4] + a[7]*d[5];
        c[5] = a[2]*d[3] + a[5]*d[4] + a[8]*d[5];

        c[6] = a[0]*d[6] + a[3]*d[7] + a[6]*d[8];
        c[7] = a[1]*d[6] + a[4]*d[7] + a[7]*d[8];
        c[8] = a[2]*d[6] + a[5]*d[7] + a[8]*d[8];

        this.data.set(c);
        return this;
    }
}
