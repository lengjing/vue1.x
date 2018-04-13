let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * 每个 dep 实例都是一个可观测对象，可被多个指令订阅
 *
 *
 */
export default function Dep() {
  this.id = uid++
  this.subs = []
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null

/**
 * Add a directive subscriber.
 *
 * @param {Directive} sub
 */
Dep.prototype.addSub = function (sub) {
  this.subs.push(sub)
}

/**
 * Remove a directive subscriber.
 *
 * @param {Directive} sub
 */
Dep.prototype.removeSub = function (sub) {
  this.subs.$remove(sub)
}

/**
 * Add self as a dependency to the target watcher.
 */
Dep.prototype.depend = function () {
  Dep.target.addDep(this)
}

/**
 * Notify all subscribers of a new value.
 */
Dep.prototype.notify = function () {
  // stablize the subscriber list first
  var subs = this.subs
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update()
  }
}
