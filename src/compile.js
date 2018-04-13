import { parseText } from './parsers/text'
import { parseDirective } from './parsers/directive'
import { replace } from './utils'
import publicDirectives from './directives/index'

const dirAttrRE = /^v-([^:]+)(?:$|:(.*)$)/

/**
 * Compile a template and return a reusable composite link
 * function, which recursively contains more link functions
 * inside. This top level compile function would normally
 * be called on instance root nodes, but can also be used
 * for partial compilation if the partial argument is true.
 *
 * The returned composite link function, when called, will
 * return an unlink function that tearsdown all directives
 * created during the linking phase.
 *
 * 编译一段模板并返回一个可以重复使用的 link 方法，
 * 这个 link 方法（compositeLinkFn）的内部闭包了很多 link 方法，它们都是通过迭代遍历的方式编译而来。
 * 在整个编译过程中最主要的就是指令的编译，当 compositeLinkFn 方法被调用的时候，
 * 每个被闭包的 link 方法会分别被执行生成一个个指令挂载到 vm 实例上（_dirtives属性里）
 * 与此同时指令的 _bind 方法也会被执行，这个 _bind 方法可以理解成“绑定指令”，相当于指令初始化。
 * 每个指令实例的内部都会包含一个 watcher 实例，用来 “watch” 依赖（dep）,
 * 当依赖变动的时候可以通知 watcher 去更新。
 *
 * @param {Element|DocumentFragment} el
 */
function compile(el) {
  var nodeLinkFn = compileNode(el)
  var childLinkFn = el.hasChildNodes
    ? compileNodeList(el.childNodes)
    : null

  return function compositeLinkFn(vm, el, host, scope, frag) {
    // link
    var dirs = linkAndCapture(function compositeLinkCapturer() {
      if (nodeLinkFn) nodeLinkFn(vm, el, host, scope, frag)
      if (childLinkFn) childLinkFn(vm, el.childNodes, host, scope, frag)
    }, vm)
    // :todo
    return function unlinkFn() {

    }
  }
}

/**
 * Apply a linker to a vm/element pair and capture the
 * directives created during the process.
 *
 * @param {Function} linker
 * @param {Vue} vm
 */
function linkAndCapture(linker, vm) {
  var originalDirCount = vm._directives.length
  linker()
  // 在有终端指令的情况下会出现多次编译，这个时候需要过滤掉已经初始化过的指令
  var dirs = vm._directives.slice(originalDirCount)
  for (var i = 0; i < dirs.length; i++) {
    dirs[i]._bind()
  }
}

/**
 * 编译单个节点
 * @param {Node} node
 * @return {Function|null}
 */
function compileNode(node) {
  var type = node.nodeType
  if (type === 1) {
    return compileElement(node)
  } else if (type === 3) {
    // 其实纯文本节点可以看成一个语法糖
    // <div>{{foo}}</div> === <div v-text="foo" />
    return compileTextNode(node)
  } else {
    return null
  }
}

/**
 * 编译节点列表
 * @param {NodeList} nodeList
 */
function compileNodeList(nodeList) {
  var linkFns = []
  var nodeLinkFn, childLinkFn, node
  for (var i = 0; i < nodeList.length; i++) {
    node = nodeList[i]
    nodeLinkFn = compileNode(node)
    childLinkFn = node.hasChildNodes &&
      // 如果是终端指令的节点那么内部的子节点都由它自己编译
      // 因为子节点内的指令有可能依赖于终端指令
      // 比如 <li v-for="item in list"> <a>{{item}}</a> </li>
      // a 标签内的 text 指令{{item}}中变量 item 是由 v-for 指令提供的
      // 所以需要由 v-for 指令自己去编译
      !(nodeLinkFn && nodeLinkFn.terminal)
      ? compileNodeList(node.childNodes)
      : null
    // 成对存放
    linkFns.push(nodeLinkFn, childLinkFn)
  }

  return function childLinkFn(vm, nodes, host, scope, frag) {
    var node, nodeLinkFn, childrenLinkFn
    for (var i = 0, n = 0, l = linkFns.length; i < l; n++) {
      node = nodes[n]
      // 成对取值
      nodeLinkFn = linkFns[i++]
      childrenLinkFn = linkFns[i++]
      var childNodes = node.childNodes
      if (nodeLinkFn) {
        nodeLinkFn(vm, node, host, scope, frag)
      }
      if (childrenLinkFn) {
        childrenLinkFn(vm, childNodes, host, scope, frag)
      }
    }
  }
}

/**
 * 编译元素
 * @param {Element} el
 */
function compileElement(el) {
  var linkFn
  var hasAttrs = el.hasAttributes()
  var attrs = hasAttrs && el.attributes
  // 检查是否包含终端指令（for 或者 if）
  if (hasAttrs) {
    linkFn = checkTerminalDirectives(el, attrs)
  }
  // 检查元素指令 eg: <v-if></v-if>
  // if (!linkFn) {
  // linkFn = checkElementDirectives(el, options)
  // }
  // 检查自定义 component eg: <my-component />
  // if (!linkFn) {
  // linkFn = checkComponent(el, options)
  // }
  // 常规指令
  if (!linkFn && hasAttrs) {
    linkFn = compileDirectives(attrs)
  }
  return linkFn
}

/**
 * 检查终端指令
 * @param {Element} el
 * @param {Array} attrs
 */
function checkTerminalDirectives(el, attrs) {
  var attr, name, value, matched, dirName, rawName, def, termDef
  for (var i = 0, j = attrs.length; i < j; i++) {
    attr = attrs[i]
    name = attr.name
    if ((matched = name.match(dirAttrRE))) {
      def = publicDirectives[matched[1]]
      if (def && def.terminal) {
        if (!termDef) {
          termDef = def
          rawName = attr.name
          value = attr.value
          dirName = matched[1]
        }
      }
    }
  }

  if (termDef) {
    var parsed = parseDirective(value)
    var descriptor = {
      name: dirName,
      expression: parsed.expression,
      raw: value,
      attr: rawName,
      def: termDef
    }

    var fn = function terminalNodeLinkFn(vm, el, host, scope, frag) {
      vm._bindDir(descriptor, el, host, scope, frag)
    }
    fn.terminal = true
    return fn
  }
}

/**
 * 编译文本节点
 * @param {Node} node
 */
function compileTextNode(node) {
  var tokens = parseText(node.wholeText)
  if (!tokens) {
    return null
  }

  var frag = document.createDocumentFragment()
  var el, token
  for (var i = 0, l = tokens.length; i < l; i++) {
    token = tokens[i]
    el = token.tag
      ? processTextToken(token)
      : document.createTextNode(token.value)
    frag.appendChild(el)
  }

  return function textNodeLinkFn(vm, el, host, scope) {
    var fragClone = frag.cloneNode(true)
    var childNodes = fragClone.childNodes
    var token, value, node
    for (var i = 0, l = tokens.length; i < l; i++) {
      token = tokens[i]
      value = token.value
      if (token.tag) {
        node = childNodes[i]
        vm._bindDir(token.descriptor, node, host, scope)
      }
    }
    replace(el, fragClone)
  }
}

/**
 * 编译指令集
 * @param {Array} attrs
 */
function compileDirectives(attrs) {
  var i = attrs.length
  var dirs = []
  var attr, name, value, rawName, rawValue, dirName, dirDef, matched
  while (i--) {
    attr = attrs[i]
    name = rawName = attr.name
    value = rawValue = attr.value

    //
    if ((matched = name.match(dirAttrRE))) {
      dirName = matched[1]

      // 应该要在 vm 实例中查找的，因为有可能存在自定义指令的情况
      // 所以这里的做法是欠妥的
      dirDef = publicDirectives[dirName]
      pushDir(dirName, dirDef)
    }
  }

  /**
   * Push a directive.
   *
   * @param {String} dirName
   * @param {Object|Function} def
   * @param {Array} [interpTokens]
   */

  function pushDir(dirName, def) {
    var parsed = parseDirective(value)
    dirs.push({
      name: dirName,
      attr: rawName,
      raw: rawValue,
      def: def,
      expression: parsed && parsed.expression
    })
  }

  if (dirs.length) {
    return function nodeLinkFn(vm, el, host, scope, frag) {
      var i = dirs.length
      while (i--) {
        vm._bindDir(dirs[i], el, host, scope, frag)
      }
    }
  }
}
/**
 * 处理文本 token
 * @param {String} token
 */
function processTextToken(token) {
  var el = document.createTextNode('')
  var parsed = parseDirective(token.value)
  var type = 'text'

  token.descriptor = {
    name: type,
    def: publicDirectives[type],
    expression: parsed.expression
  }

  return el
}

export default compile
