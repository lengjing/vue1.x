export function stringToFragment(templateString) {
  var frag = document.createDocumentFragment()
  var div = document.createElement('div')

  div.innerHTML = templateString

  var child
  while (child = div.firstChild) {
    frag.appendChild(child)
  }

  return frag
}

export function nodeToFragment(node) {
  var nodeClone = node.cloneNode(true)
  var frag = document.createDocumentFragment()

  var child
  while (child = nodeClone.firstChild) {
    frag.appendChild(child)
  }

  return frag
}

export function parseTemplate(template) {
  var node, frag

  if (typeof template === 'string') {
    // id selector
    if (template.charAt(0) === '#') {
      node = document.getElementById(template.slice(1))
      if (node) {
        frag = nodeToFragment(node)
      }
    } else {
      // normal string template
      frag = stringToFragment(template)
    }
  } else if (template.nodeType) {
    // a direct node
    frag = nodeToFragment(template)
  }

  return frag
}
