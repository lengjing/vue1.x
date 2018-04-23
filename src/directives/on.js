function on(el, event, handler, useCapture) {
  el.addEventListener(event, handler, useCapture)
}

function off(el, handler, callback) {
  el.removeEventListener(handler, callback)
}



export default {
  bind() {

  },

  update(value) {
    this.handler = value
    this.reset()

    on(this.el, this.arg, this.handler)
  },

  reset() {
    off(this.el, this.handler)
  }
}
