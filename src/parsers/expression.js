export function parseExpression(exp) {
  return {
    get: makeGetterFn('scope.' + exp),
    set: function () { }
  }
}

function makeGetterFn(body) {
  var fn = new Function('scope', 'Math', 'return ' + body)
  return function (scope) {
    return fn.call(this, scope, Math)
  }
}
