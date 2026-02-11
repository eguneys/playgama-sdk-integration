/**
 * For timing of delayed events
 */
export class Delay {

    private time = 0
    private next_pop = Infinity
    private line: string[] = []

    private _action: string = ''

    /**
     * @param line A space separated mix of event names and delay timings
     * 
     * `.set_line('500 spawn')` will fire a `spawn` event after 500ms
     * 
     * `.set_line('500')` will fire an `end` event after 500ms
     */
    set_line(line: string) {
        this.line = line.split(' ')
        this.next_pop = this.time
        return this
    }

    /**
     * Query the fired events in the update loop with `delay.action`
     */
    get action() {

        return this._action
    }

    /**
     * Call this in your update loop
     * @param delta in milliseconds
     */
    update(delta: number) {
        this.time += delta

        if (this.line.length === 0) {
            if (this.time >= this.next_pop) {
                this.next_pop = Infinity
                this._action = 'end'
            } else if(this.next_pop < Infinity) {
                this._action = 'delay'
            } else {
                this._action = ''
            }
            return
        }

        if (this.time >= this.next_pop) {

            let res = this.line.shift()!

            let delay = parseInt(res)
            
            if (isNaN(delay)) {
                this._action = res
                this.next_pop = this.time
            } else {
                this.next_pop += delay
                this._action = 'delay'
            }
        } else {
            this._action = 'delay'
        }

    }
}