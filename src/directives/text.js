export default {
  bind() {
    this.attr = this.el.nodeType === 3
      ? 'data'
      : 'textContent'
  },

  update(value) {
    this.el[this.attr] = value
  }
}
