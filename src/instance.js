import compile from './compile'
import Directive from './directive'
import { stringToFragment, nodeToFragment } from './parsers/template'
import { observe } from './observer'
import { replace, isFunction } from './utils'

function Vue(options) {
  this._init(options)
}

Vue.prototype._init = function (options) {
  this.$options = options || {}

  this._directives = []
  this._watchers = []

  this._initData()

  if (options.el) {
    // 程序编译的入口
    this.$mount(options.el)
  }
}

/**
 * 初始化 data
 */
Vue.prototype._initData = function () {
  var dataFn = this.$options.data
  var data = this._data = isFunction(dataFn)
    ? dataFn()
    : dataFn
  var keys = Object.keys(data)
  var i, key
  i = keys.length
  while (i--) {
    key = keys[i]
    // 把 data 属性下的 key 代理到 vm 实例上
    this._proxy(key)
  }
  // observable 化 data
  // 目的为了让 data 在取值/赋值的时候可被监听
  // 从而实现响应式的效果
  observe(data, this)
}

Vue.prototype._proxy = function (key) {
  var self = this
  Object.defineProperty(self, key, {
    configurable: true,
    enumerable: true,
    get: function proxyGetter() {
      return self._data[key]
    },
    set: function proxySetter(val) {
      self._data[key] = val
    }
  })
}

Vue.prototype._bindDir = function (descriptor, node, host, scope) {
  this._directives.push(
    new Directive(descriptor, this, node, host, scope)
  )
}

Vue.prototype._compile = function (el) {
  var options = this.$options
  var original = el
  // el = transclude(el)
  // 源码里使用了一个叫做 transclude 的方法来做了很多兼容处理,非常复杂
  if (options.template) {
    el = stringToFragment(options.template)
  } else {
    el = nodeToFragment(el)
  }

  var linkFn = compile(el)
  var unlinkFn = linkFn(this, el)

  replace(original, el)
}

Vue.prototype.$mount = function (el) {
  el = document.querySelector(el)

  this._compile(el)
}

export default Vue
