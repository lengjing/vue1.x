import Watcher from './watcher'
import { extend } from './utils'

/**
 * 指令类
 * @param {*} descriptor
 * @param {*} vm
 * @param {*} el
 * @param {*} host
 * @param {*} scope
 * @param {*} frag
 */
export default function Directive(descriptor, vm, el, host, scope, frag) {
  this.vm = vm
  this.el = el
  this.descriptor = descriptor
  this.name = descriptor.name
  this.expression = descriptor.expression
  this.arg = descriptor.arg
  // private
  // this._locked = false
  // this._bound = false
  // this._listeners = null
  // link context
  this._host = host
  this._scope = scope
  this._frag = frag
}

Directive.prototype._bind = function () {
  var name = this.name
  var descriptor = this.descriptor

  // 移除属性
  // 编译过的节点需要移除指令属性防止被再次编译
  if (this.el && this.el.removeAttribute) {
    var attr = descriptor.attr || ('v-' + name)
    this.el.removeAttribute(attr)
  }

  // 复制 def 属性
  var def = descriptor.def
  if (typeof def === 'function') {
    this.update = def
  } else {
    extend(this, def)
  }

  // 初始化 bind
  if (this.bind) {
    this.bind()
  }
  this._bound = true

  if (this.expression && this.update) {
    var dir = this
    // 这里套了一层 function 目的是为了让 update 方法内的 this 指向正对的对象
    this._update = function (val, oldVal) {
      dir.update(val, oldVal)
    }

    var watcher = this._watcher = new Watcher(
      this.vm,
      this.expression,
      this._update, // callback
      {
        scope: this._scope
      }
    )

    // if (this.afterBind) {
    //   this.afterBind()
    // } else if (this.update) {
    //   this.update(watcher.value)
    // }
    if (this.update) {
      this.update(watcher.value)
    }
  }
}
