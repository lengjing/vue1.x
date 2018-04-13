const tagRE = /{{((?:.|\n)+?)}}/g

/**
 * 解析文本
 * eg: aaa{{var}}bbb => [{value: 'aaa'}, {value: 'var', tag: true}, {value: 'bbb'}]
 * @param {String} text
 */
export function parseText(text) {
  if (!tagRE.test(text)) {
    return null
  }
  var tokens = []
  var lastIndex = tagRE.lastIndex = 0
  var match, index, value
  while (match = tagRE.exec(text)) {
    index = match.index
    value = match[1]
    if (index > lastIndex) {
      tokens.push({
        value: text.slice(lastIndex, index)
      })
    }

    tokens.push({
      tag: true,
      value: value.trim(),
    })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) {
    tokens.push({
      value: text.slice(lastIndex)
    })
  }
  return tokens
}
