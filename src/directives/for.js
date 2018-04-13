import { before, replace, isObject } from '../utils'
import { defineReactive } from '../observer'
import compile from '../compile'

const createAnchor = function (anchor) {
  return document.createComment(anchor)
}

const inDoc = function inDoc(node) {
  if (!node) return false
  var doc = node.ownerDocument.documentElement
  var parent = node.parentNode
  return doc === node ||
    doc === parent ||
    !!(parent && parent.nodeType === 1 && (doc.contains(parent)))
}

let uid = 0

// 源码里 for 指令写的特别特别复杂

const vFor = {

  terminal: true,

  bind() {
    // support "item in/of items" syntax
    var inMatch = this.expression.match(/(.*) (?:in|of) (.*)/)
    if (inMatch) {
      var itMatch = inMatch[1].match(/\((.*),(.*)\)/)
      if (itMatch) {
        this.iterator = itMatch[1].trim()
        this.alias = itMatch[2].trim()
      } else {
        this.alias = inMatch[1].trim()
      }
      this.expression = inMatch[2]
    }

    // uid as a cache identifier
    this.id = '__v-for__' + (++uid)

    // 添加锚点
    this.start = createAnchor('v-for-start')
    this.end = createAnchor('v-for-end')

    replace(this.el, this.end)
    before(this.start, this.end)

    // 先不缓存了，简单点
    // this.cache = Object.create(null)
  },

  update(data) {
    var item = data[0]
    var alias = this.alias
    var start = this.start
    var end = this.end
    // var inDocument = inDoc(start)
    var i, l, frag, key, value

    // 每次 update 的时候都先清除下 frag，很粗暴的做法
    this.empty()

    for (i = 0, l = data.length; i < l; i++) {
      item = data[i]
      key = null
      value = item
      frag = this.create(value, alias, i, key)

      before(frag, end)
    }
  },
  /**
   * Create a new fragment instance.
   *
   * @param {*} value
   * @param {String} alias
   * @param {Number} index
   * @param {String} [key]
   * @return {Fragment}
   */
  create(value, alias, index, key) {
    var host = this._host
    // create iteration scope
    var parentScope = this._scope || this.vm
    var scope = Object.create(parentScope)
    // ref holder for the scope
    // scope.$refs = Object.create(parentScope.$refs)
    // scope.$els = Object.create(parentScope.$els)
    // make sure point $parent to parent scope
    scope.$parent = parentScope
    // for two-way binding on alias
    scope.$forContext = this
    // define scope properties
    // important: define the scope alias without forced conversion
    // so that frozen data structures remain non-reactive.
    defineReactive(scope, alias, value)

    // 创建一个 frag 让他单独和自己的 scope 去 link
    var docFrag = document.createDocumentFragment()
    docFrag.appendChild(this.el)
    var template = docFrag.cloneNode(true).firstChild
    var linker = compile(this.el)
    var unlink = linker(this.vm, template, null, scope)
    var frag = template

    frag.forId = this.id

    return frag
  },

  // 清除锚点间的节点
  empty() {
    var start = this.start
    var end = this.end
    while (start.nextSibling && start.nextSibling !== end) {
      this.remove(start.nextSibling)
    }
  },
  remove(node) {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node)
    }
  }
}

export default vFor
