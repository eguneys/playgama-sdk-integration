export function load_image(src: string) {
    let image = new Image()
    return new Promise<HTMLImageElement>(resolve => {
        image.onload = () => resolve(image)
        image.src = src
    })
}
