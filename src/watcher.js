import Dep from './dep'
import { parseExpression } from './parsers/expression'
import { extend } from './utils'

let uid = 0

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 *
 * @param {*} vm
 * @param {*} expOrFn
 * @param {*} cb
 * @param {*} options
 */
export default function Watcher(vm, expOrFn, cb, options) {
  if (options) {
    extend(this, options)
  }
  var isFn = typeof expOrFn === 'function'
  this.vm = vm
  vm._watchers.push(this)
  this.expression = expOrFn
  this.cb = cb
  this.id = ++uid // uid for batching
  this.active = true
  this.deps = []
  this.newDeps = []
  this.depIds = new Set()
  this.newDepIds = new Set()

  // parse expression for getter/setter
  if (isFn) {
    this.getter = expOrFn
    this.setter = undefined
  } else {
    var res = parseExpression(expOrFn)
    this.getter = res.get
    this.setter = res.set
  }
  this.value = this.lazy
    ? undefined
    : this.get()
}

Watcher.prototype.get = function () {
  Dep.target = this

  var scope = this.scope || this.vm
  var value
  try {
    value = this.getter.call(scope, scope)
  } catch (e) {
    console.log(e)
  }
  return value
}

Watcher.prototype.addDep = function (dep) {
  var id = dep.id
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id)
    this.newDeps.push(dep)
    if (!this.depIds.has(id)) {
      dep.addSub(this)
    }
  }

}

Watcher.prototype.update = function () {
  var value = this.get()
  if (
    value !== this.value
  ) {
    // set new value
    var oldValue = this.value
    this.value = value
    this.cb.call(this.vm, value, oldValue)
  }
}
