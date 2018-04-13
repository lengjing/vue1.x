export default {

  bind() {
    // a comment node means this is a binding for
    // {{{ inline unescaped html }}}
    if (this.el.nodeType === 8) {
      // hold nodes
      this.nodes = []
      // replace the placeholder with proper anchor
      this.anchor = document.createTextNode('v-html')
      replace(this.el, this.anchor)
    }
  },

  update(value) {
    if (this.nodes) {
      this.swap(value)
    } else {
      this.el.innerHTML = value
    }
  },

  swap(value) {
    // remove old nodes
    var i = this.nodes.length
    while (i--) {
      remove(this.nodes[i])
    }
    // convert new value to a fragment
    // do not attempt to retrieve from id selector
    var frag = value ? parseTemplate(value) : document.createComment('')
    // save a reference to these nodes so we can remove later
    this.nodes = frag.childNodes
    before(frag, this.anchor)
  }
}
