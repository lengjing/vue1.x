/*!
 * Vue.js v1.0.28-csp
 * (c) 2018 Evan You
 * Released under the MIT License.
 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global.Vue = factory());
}(this, (function () { 'use strict';

var tagRE = /{{((?:.|\n)+?)}}/g;

/**
 * 解析文本
 * eg: aaa{{var}}bbb => [{value: 'aaa'}, {value: 'var', tag: true}, {value: 'bbb'}]
 * @param {String} text
 */

function parseText(text) {
  if (!tagRE.test(text)) {
    return null;
  }
  var tokens = [];
  var lastIndex = tagRE.lastIndex = 0;
  var match, index, value;
  while (match = tagRE.exec(text)) {
    index = match.index;
    value = match[1];
    if (index > lastIndex) {
      tokens.push({
        value: text.slice(lastIndex, index)
      });
    }

    tokens.push({
      tag: true,
      value: value.trim()
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({
      value: text.slice(lastIndex)
    });
  }
  return tokens;
}

var str;
var dir;
var len;
var index;
var chr;
var state;
var startState = 0;
var filterState = 1;
var filterNameState = 2;
var filterArgState = 3;

var doubleChr = 0x22;
var singleChr = 0x27;
var pipeChr = 0x7C;
var escapeChr = 0x5C;
var spaceChr = 0x20;

var expStartChr = { 0x5B: 1, 0x7B: 1, 0x28: 1 };
var expChrPair = { 0x5B: 0x5D, 0x7B: 0x7D, 0x28: 0x29 };

function peek() {
  return str.charCodeAt(index + 1);
}

function next() {
  return str.charCodeAt(++index);
}

function eof() {
  return index >= len;
}

function eatSpace() {
  while (peek() === spaceChr) {
    next();
  }
}

function isStringStart(chr) {
  return chr === doubleChr || chr === singleChr;
}

function isExpStart(chr) {
  return expStartChr[chr];
}

function isExpEnd(start, chr) {
  return expChrPair[start] === chr;
}

function parseString() {
  var stringQuote = next();
  var chr;
  while (!eof()) {
    chr = next();
    // escape char
    if (chr === escapeChr) {
      next();
    } else if (chr === stringQuote) {
      break;
    }
  }
}

function parseSpecialExp(chr) {
  var inExp = 0;
  var startChr = chr;

  while (!eof()) {
    chr = peek();
    if (isStringStart(chr)) {
      parseString();
      continue;
    }

    if (startChr === chr) {
      inExp++;
    }
    if (isExpEnd(startChr, chr)) {
      inExp--;
    }

    next();

    if (inExp === 0) {
      break;
    }
  }
}

/**
 * syntax:
 * expression | filterName  [arg  arg [| filterName arg arg]]
 */

function parseExpression() {
  var start = index;
  while (!eof()) {
    chr = peek();
    if (isStringStart(chr)) {
      parseString();
    } else if (isExpStart(chr)) {
      parseSpecialExp(chr);
    } else if (chr === pipeChr) {
      next();
      chr = peek();
      if (chr === pipeChr) {
        next();
      } else {
        if (state === startState || state === filterArgState) {
          state = filterState;
        }
        break;
      }
    } else if (chr === spaceChr && (state === filterNameState || state === filterArgState)) {
      eatSpace();
      break;
    } else {
      if (state === filterState) {
        state = filterNameState;
      }
      next();
    }
  }

  return str.slice(start + 1, index) || null;
}

function parseDirective(s) {
  // reset parser state
  str = s;
  dir = {};
  len = str.length;
  index = -1;
  chr = '';
  state = startState;

  var filters;

  dir.expression = parseExpression().trim();

  return dir;
}

function replace$1(target, el) {
  var parent = target.parentNode;
  if (parent) {
    parent.replaceChild(el, target);
  }
}

function before$1(el, target) {
  target.parentNode.insertBefore(el, target);
}

function extend(to, from) {
  for (var i in from) {
    to[i] = from[i];
  }
}

function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  });
}

function isFunction(func) {
  return typeof func === 'function';
}

var text = {
  bind: function bind() {
    this.attr = this.el.nodeType === 3 ? 'data' : 'textContent';
  },

  update: function update(value) {
    this.el[this.attr] = value;
  }
};

var html = {

  bind: function bind() {
    // a comment node means this is a binding for
    // {{{ inline unescaped html }}}
    if (this.el.nodeType === 8) {
      // hold nodes
      this.nodes = [];
      // replace the placeholder with proper anchor
      this.anchor = document.createTextNode('v-html');
      replace(this.el, this.anchor);
    }
  },

  update: function update(value) {
    if (this.nodes) {
      this.swap(value);
    } else {
      this.el.innerHTML = value;
    }
  },

  swap: function swap(value) {
    // remove old nodes
    var i = this.nodes.length;
    while (i--) {
      remove(this.nodes[i]);
    }
    // convert new value to a fragment
    // do not attempt to retrieve from id selector
    var frag = value ? parseTemplate(value) : document.createComment('');
    // save a reference to these nodes so we can remove later
    this.nodes = frag.childNodes;
    before(frag, this.anchor);
  }
};

var uid$1 = 0;

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * 每个 dep 实例都是一个可观测对象，可被多个指令订阅
 *
 *
 */
function Dep() {
  this.id = uid$1++;
  this.subs = [];
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null;

/**
 * Add a directive subscriber.
 *
 * @param {Directive} sub
 */
Dep.prototype.addSub = function (sub) {
  this.subs.push(sub);
};

/**
 * Remove a directive subscriber.
 *
 * @param {Directive} sub
 */
Dep.prototype.removeSub = function (sub) {
  this.subs.$remove(sub);
};

/**
 * Add self as a dependency to the target watcher.
 */
Dep.prototype.depend = function () {
  Dep.target.addDep(this);
};

/**
 * Notify all subscribers of a new value.
 */
Dep.prototype.notify = function () {
  // stablize the subscriber list first
  var subs = this.subs;
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update();
  }
};

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 * @constructor
 */

function Observer(value) {
  this.value = value;
  this.dep = new Dep();
  def(value, '__ob__', this);
  if (Array.isArray(value)) {
    this.observeArray(value);
  } else {
    this.walk(value);
  }
}

// Instance methods

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object.
 *
 * @param {Object} obj
 */

Observer.prototype.walk = function (obj) {
  var keys = Object.keys(obj);
  for (var i = 0, l = keys.length; i < l; i++) {
    this.convert(keys[i], obj[keys[i]]);
  }
};

/**
 * Observe a list of Array items.
 *
 * @param {Array} items
 */

Observer.prototype.observeArray = function (items) {
  for (var i = 0, l = items.length; i < l; i++) {
    observe(items[i]);
  }
};

/**
 * Convert a property into getter/setter so we can emit
 * the events when the property is accessed/changed.
 *
 * @param {String} key
 * @param {*} val
 */

Observer.prototype.convert = function (key, val) {
  defineReactive(this.value, key, val);
};

/**
 * Add an owner vm, so that when $set/$delete mutations
 * happen we can notify owner vms to proxy the keys and
 * digest the watchers. This is only called when the object
 * is observed as an instance's root $data.
 *
 * @param {Vue} vm
 */

Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm);
};

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */

function observe(value, vm) {
  if (!value || typeof value !== 'object') {
    return;
  }
  var ob = new Observer(value);
  if (ob && vm) {
    ob.addVm(vm);
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 */

function defineReactive(obj, key, val) {
  var dep = new Dep();

  var property = Object.getOwnPropertyDescriptor(obj, key);
  if (property && property.configurable === false) {
    return;
  }

  // cater for pre-defined getter/setters
  var getter = property && property.get;
  var setter = property && property.set;

  var childOb = observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      var value = getter ? getter.call(obj) : val;
      if (Dep.target) {
        dep.depend();
        if (childOb) {
          childOb.dep.depend();
        }
        if (Array.isArray(value)) {
          for (var e, i = 0, l = value.length; i < l; i++) {
            e = value[i];
            e && e.__ob__ && e.__ob__.dep.depend();
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      var value = getter ? getter.call(obj) : val;
      if (newVal === value) {
        return;
      }
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      childOb = observe(newVal);
      dep.notify();
    }
  });
}

var createAnchor = function createAnchor(anchor) {
  return document.createComment(anchor);
};

var uid = 0;

// 源码里 for 指令写的特别特别复杂

var vFor = {

  terminal: true,

  bind: function bind() {
    // support "item in/of items" syntax
    var inMatch = this.expression.match(/(.*) (?:in|of) (.*)/);
    if (inMatch) {
      var itMatch = inMatch[1].match(/\((.*),(.*)\)/);
      if (itMatch) {
        this.iterator = itMatch[1].trim();
        this.alias = itMatch[2].trim();
      } else {
        this.alias = inMatch[1].trim();
      }
      this.expression = inMatch[2];
    }

    // uid as a cache identifier
    this.id = '__v-for__' + ++uid;

    // 添加锚点
    this.start = createAnchor('v-for-start');
    this.end = createAnchor('v-for-end');

    replace$1(this.el, this.end);
    before$1(this.start, this.end);

    // 先不缓存了，简单点
    // this.cache = Object.create(null)
  },

  update: function update(data) {
    var item = data[0];
    var alias = this.alias;
    var start = this.start;
    var end = this.end;
    // var inDocument = inDoc(start)
    var i, l, frag, key, value;

    // 每次 update 的时候都先清除下 frag，很粗暴的做法
    this.empty();

    for (i = 0, l = data.length; i < l; i++) {
      item = data[i];
      key = null;
      value = item;
      frag = this.create(value, alias, i, key);

      before$1(frag, end);
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
  create: function create(value, alias, index, key) {
    var host = this._host;
    // create iteration scope
    var parentScope = this._scope || this.vm;
    var scope = Object.create(parentScope);
    // ref holder for the scope
    // scope.$refs = Object.create(parentScope.$refs)
    // scope.$els = Object.create(parentScope.$els)
    // make sure point $parent to parent scope
    scope.$parent = parentScope;
    // for two-way binding on alias
    scope.$forContext = this;
    // define scope properties
    // important: define the scope alias without forced conversion
    // so that frozen data structures remain non-reactive.
    defineReactive(scope, alias, value);

    // 创建一个 frag 让他单独和自己的 scope 去 link
    var docFrag = document.createDocumentFragment();
    docFrag.appendChild(this.el);
    var template = docFrag.cloneNode(true).firstChild;
    var linker = compile(this.el);
    var unlink = linker(this.vm, template, null, scope);
    var frag = template;

    frag.forId = this.id;

    return frag;
  },

  // 清除锚点间的节点
  empty: function empty() {
    var start = this.start;
    var end = this.end;
    while (start.nextSibling && start.nextSibling !== end) {
      this.remove(start.nextSibling);
    }
  },
  remove: function remove(node) {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }
};

var publicDirectives = {
  text: text,
  html: html,
  'for': vFor
};

var dirAttrRE = /^v-([^:]+)(?:$|:(.*)$)/;

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
  var nodeLinkFn = compileNode(el);
  var childLinkFn = el.hasChildNodes ? compileNodeList(el.childNodes) : null;

  return function compositeLinkFn(vm, el, host, scope, frag) {
    // link
    var dirs = linkAndCapture(function compositeLinkCapturer() {
      if (nodeLinkFn) nodeLinkFn(vm, el, host, scope, frag);
      if (childLinkFn) childLinkFn(vm, el.childNodes, host, scope, frag);
    }, vm);
    // :todo
    return function unlinkFn() {};
  };
}

/**
 * Apply a linker to a vm/element pair and capture the
 * directives created during the process.
 *
 * @param {Function} linker
 * @param {Vue} vm
 */
function linkAndCapture(linker, vm) {
  var originalDirCount = vm._directives.length;
  linker();
  // 在有终端指令的情况下会出现多次编译，这个时候需要过滤掉已经初始化过的指令
  var dirs = vm._directives.slice(originalDirCount);
  for (var i = 0; i < dirs.length; i++) {
    dirs[i]._bind();
  }
}

/**
 * 编译单个节点
 * @param {Node} node
 * @return {Function|null}
 */
function compileNode(node) {
  var type = node.nodeType;
  if (type === 1) {
    return compileElement(node);
  } else if (type === 3) {
    // 其实纯文本节点可以看成一个语法糖
    // <div>{{foo}}</div> === <div v-text="foo" />
    return compileTextNode(node);
  } else {
    return null;
  }
}

/**
 * 编译节点列表
 * @param {NodeList} nodeList
 */
function compileNodeList(nodeList) {
  var linkFns = [];
  var nodeLinkFn, childLinkFn, node;
  for (var i = 0; i < nodeList.length; i++) {
    node = nodeList[i];
    nodeLinkFn = compileNode(node);
    childLinkFn = node.hasChildNodes &&
    // 如果是终端指令的节点那么内部的子节点都由它自己编译
    // 因为子节点内的指令有可能依赖于终端指令
    // 比如 <li v-for="item in list"> <a>{{item}}</a> </li>
    // a 标签内的 text 指令{{item}}中变量 item 是由 v-for 指令提供的
    // 所以需要由 v-for 指令自己去编译
    !(nodeLinkFn && nodeLinkFn.terminal) ? compileNodeList(node.childNodes) : null;
    // 成对存放
    linkFns.push(nodeLinkFn, childLinkFn);
  }

  return function childLinkFn(vm, nodes, host, scope, frag) {
    var node, nodeLinkFn, childrenLinkFn;
    for (var i = 0, n = 0, l = linkFns.length; i < l; n++) {
      node = nodes[n];
      // 成对取值
      nodeLinkFn = linkFns[i++];
      childrenLinkFn = linkFns[i++];
      var childNodes = node.childNodes;
      if (nodeLinkFn) {
        nodeLinkFn(vm, node, host, scope, frag);
      }
      if (childrenLinkFn) {
        childrenLinkFn(vm, childNodes, host, scope, frag);
      }
    }
  };
}

/**
 * 编译元素
 * @param {Element} el
 */
function compileElement(el) {
  var linkFn;
  var hasAttrs = el.hasAttributes();
  var attrs = hasAttrs && el.attributes;
  // 检查是否包含终端指令（for 或者 if）
  if (hasAttrs) {
    linkFn = checkTerminalDirectives(el, attrs);
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
    linkFn = compileDirectives(attrs);
  }
  return linkFn;
}

/**
 * 检查终端指令
 * @param {Element} el
 * @param {Array} attrs
 */
function checkTerminalDirectives(el, attrs) {
  var attr, name, value, matched, dirName, rawName, def, termDef;
  for (var i = 0, j = attrs.length; i < j; i++) {
    attr = attrs[i];
    name = attr.name;
    if (matched = name.match(dirAttrRE)) {
      def = publicDirectives[matched[1]];
      if (def && def.terminal) {
        if (!termDef) {
          termDef = def;
          rawName = attr.name;
          value = attr.value;
          dirName = matched[1];
        }
      }
    }
  }

  if (termDef) {
    var parsed = parseDirective(value);
    var descriptor = {
      name: dirName,
      expression: parsed.expression,
      raw: value,
      attr: rawName,
      def: termDef
    };

    var fn = function terminalNodeLinkFn(vm, el, host, scope, frag) {
      vm._bindDir(descriptor, el, host, scope, frag);
    };
    fn.terminal = true;
    return fn;
  }
}

/**
 * 编译文本节点
 * @param {Node} node
 */
function compileTextNode(node) {
  var tokens = parseText(node.wholeText);
  if (!tokens) {
    return null;
  }

  var frag = document.createDocumentFragment();
  var el, token;
  for (var i = 0, l = tokens.length; i < l; i++) {
    token = tokens[i];
    el = token.tag ? processTextToken(token) : document.createTextNode(token.value);
    frag.appendChild(el);
  }

  return function textNodeLinkFn(vm, el, host, scope) {
    var fragClone = frag.cloneNode(true);
    var childNodes = fragClone.childNodes;
    var token, value, node;
    for (var i = 0, l = tokens.length; i < l; i++) {
      token = tokens[i];
      value = token.value;
      if (token.tag) {
        node = childNodes[i];
        vm._bindDir(token.descriptor, node, host, scope);
      }
    }
    replace$1(el, fragClone);
  };
}

/**
 * 编译指令集
 * @param {Array} attrs
 */
function compileDirectives(attrs) {
  var i = attrs.length;
  var dirs = [];
  var attr, name, value, rawName, rawValue, dirName, dirDef, matched;
  while (i--) {
    attr = attrs[i];
    name = rawName = attr.name;
    value = rawValue = attr.value;

    //
    if (matched = name.match(dirAttrRE)) {
      dirName = matched[1];

      // 应该要在 vm 实例中查找的，因为有可能存在自定义指令的情况
      // 所以这里的做法是欠妥的
      dirDef = publicDirectives[dirName];
      pushDir(dirName, dirDef);
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
    var parsed = parseDirective(value);
    dirs.push({
      name: dirName,
      attr: rawName,
      raw: rawValue,
      def: def,
      expression: parsed && parsed.expression
    });
  }

  if (dirs.length) {
    return function nodeLinkFn(vm, el, host, scope, frag) {
      var i = dirs.length;
      while (i--) {
        vm._bindDir(dirs[i], el, host, scope, frag);
      }
    };
  }
}
/**
 * 处理文本 token
 * @param {String} token
 */
function processTextToken(token) {
  var el = document.createTextNode('');
  var parsed = parseDirective(token.value);
  var type = 'text';

  token.descriptor = {
    name: type,
    def: publicDirectives[type],
    expression: parsed.expression
  };

  return el;
}

function parseExpression$1(exp) {
  return {
    get: makeGetterFn('scope.' + exp),
    set: function set() {}
  };
}

function makeGetterFn(body) {
  var fn = new Function('scope', 'Math', 'return ' + body);
  return function (scope) {
    return fn.call(this, scope, Math);
  };
}

var uid$2 = 0;

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
function Watcher(vm, expOrFn, cb, options) {
  if (options) {
    extend(this, options);
  }
  var isFn = typeof expOrFn === 'function';
  this.vm = vm;
  vm._watchers.push(this);
  this.expression = expOrFn;
  this.cb = cb;
  this.id = ++uid$2; // uid for batching
  this.active = true;
  this.deps = [];
  this.newDeps = [];
  this.depIds = new Set();
  this.newDepIds = new Set();

  // parse expression for getter/setter
  if (isFn) {
    this.getter = expOrFn;
    this.setter = undefined;
  } else {
    var res = parseExpression$1(expOrFn);
    this.getter = res.get;
    this.setter = res.set;
  }
  this.value = this.lazy ? undefined : this.get();
}

Watcher.prototype.get = function () {
  Dep.target = this;

  var scope = this.scope || this.vm;
  var value;
  try {
    value = this.getter.call(scope, scope);
  } catch (e) {
    console.log(e);
  }
  return value;
};

Watcher.prototype.addDep = function (dep) {
  var id = dep.id;
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id);
    this.newDeps.push(dep);
    if (!this.depIds.has(id)) {
      dep.addSub(this);
    }
  }
};

Watcher.prototype.update = function () {
  var value = this.get();
  if (value !== this.value) {
    // set new value
    var oldValue = this.value;
    this.value = value;
    this.cb.call(this.vm, value, oldValue);
  }
};

/**
 * 指令类
 * @param {*} descriptor
 * @param {*} vm
 * @param {*} el
 * @param {*} host
 * @param {*} scope
 * @param {*} frag
 */
function Directive(descriptor, vm, el, host, scope, frag) {
  this.vm = vm;
  this.el = el;
  this.descriptor = descriptor;
  this.name = descriptor.name;
  this.expression = descriptor.expression;
  // private
  // this._locked = false
  // this._bound = false
  // this._listeners = null
  // link context
  this._host = host;
  this._scope = scope;
  this._frag = frag;
}

Directive.prototype._bind = function () {
  var name = this.name;
  var descriptor = this.descriptor;

  // 移除属性
  // 编译过的节点需要移除指令属性防止被再次编译
  if (this.el && this.el.removeAttribute) {
    var attr = descriptor.attr || 'v-' + name;
    this.el.removeAttribute(attr);
  }

  // 复制 def 属性
  var def = descriptor.def;
  if (typeof def === 'function') {
    this.update = def;
  } else {
    extend(this, def);
  }

  // 初始化 bind
  if (this.bind) {
    this.bind();
  }
  this._bound = true;

  if (this.expression && this.update) {
    var dir = this;
    // 这里套了一层 function 目的是为了让 update 方法内的 this 指向正对的对象
    this._update = function (val, oldVal) {
      dir.update(val, oldVal);
    };

    var watcher = this._watcher = new Watcher(this.vm, this.expression, this._update, // callback
    {
      scope: this._scope
    });
    // v-model with inital inline value need to sync back to
    // model instead of update to DOM on init. They would
    // set the afterBind hook to indicate that.
    // if (this.afterBind) {
    //   this.afterBind()
    // } else if (this.update) {
    //   this.update(watcher.value)
    // }
    if (this.update) {
      this.update(watcher.value);
    }
  }
};

function stringToFragment(templateString) {
  var frag = document.createDocumentFragment();
  var div = document.createElement('div');

  div.innerHTML = templateString;

  var child;
  while (child = div.firstChild) {
    frag.appendChild(child);
  }

  return frag;
}

function nodeToFragment(node) {
  var nodeClone = node.cloneNode(true);
  var frag = document.createDocumentFragment();

  var child;
  while (child = nodeClone.firstChild) {
    frag.appendChild(child);
  }

  return frag;
}

function Vue(options) {
  this._init(options);
}

Vue.prototype._init = function (options) {
  this.$options = options || {};

  this._directives = [];
  this._watchers = [];

  this._initData();

  if (options.el) {
    // 程序编译的入口
    this.$mount(options.el);
  }
};

/**
 * 初始化 data
 */
Vue.prototype._initData = function () {
  var dataFn = this.$options.data;
  // 官方文档建议使用 function 的形式
  var data = this._data = isFunction(dataFn) ? dataFn() : dataFn;
  var keys = Object.keys(data);
  var i, key;
  i = keys.length;
  while (i--) {
    key = keys[i];
    // 把 data 属性下的 key 代理到 vm 实例上
    this._proxy(key);
  }
  // observable 化 data
  // 目的为了让 data 在取值/赋值的时候可被监听
  // 从而实现响应式的效果
  observe(data, this);
};

Vue.prototype._proxy = function (key) {
  var self = this;
  Object.defineProperty(self, key, {
    configurable: true,
    enumerable: true,
    get: function proxyGetter() {
      return self._data[key];
    },
    set: function proxySetter(val) {
      self._data[key] = val;
    }
  });
};

Vue.prototype._bindDir = function (descriptor, node, host, scope) {
  this._directives.push(new Directive(descriptor, this, node, host, scope));
};

Vue.prototype._compile = function (el) {
  var options = this.$options;
  var original = el;
  // el = transclude(el)
  // 源码里使用了一个叫做 transclude 的方法来做了很多兼容处理,非常复杂
  if (options.template) {
    el = stringToFragment(options.template);
  } else {
    el = nodeToFragment(el);
  }

  var linkFn = compile(el);
  var unlinkFn = linkFn(this, el);

  replace$1(original, el);
};

Vue.prototype.$mount = function (el) {
  el = document.querySelector(el);

  this._compile(el);
};

return Vue;

})));