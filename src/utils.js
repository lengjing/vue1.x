export function replace(target, el) {
  var parent = target.parentNode
  if (parent) {
    parent.replaceChild(el, target)
  }
}

export function before(el, target) {
  target.parentNode.insertBefore(el, target)
}

export function extend(to, from) {
  for (var i in from) {
    to[i] = from[i]
  }
}

export function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  })
}

export function isFunction(func) {
  return typeof func === 'function'
}

export function bind (fn, ctx) {
  return function (a) {
    var l = arguments.length
    return l
      ? l > 1
        ? fn.apply(ctx, arguments)
        : fn.call(ctx, a)
      : fn.call(ctx)
  }
}

export function isObject (obj) {
  return obj !== null && typeof obj === 'object'
}
