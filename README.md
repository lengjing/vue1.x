
## 介绍

程序从最上层可以分为
1. 全局设计
2. vm 实例设计包括接口设计（vm 原型）、实例初始化（vm 构造函数）

整个实例初始化的过程中，最重要的就是把数据 (Model) 和视图 (View) 建立起关联关系。

- 通过 observer 对 data 进行了监听，并且提供订阅某个数据项的变化的能力
- 把 template 或者 dom 解析成一段 document fragment，然后解析其中的 directive，得到每一个 directive 所依赖的数据项及其更新方法。比如 v-text="message" 被解析之后 (这里仅作示意，实际程序逻辑会更严谨而复杂)：
  - 所依赖的数据项 this.$data.message
  - 相应的视图更新方法 node.textContent = this.$data.message
- 通过 watcher 把上述两部分结合起来，即把 directive 中的数据依赖订阅在对应数据的 observer 上，这样当数据变化的时候，就会触发 observer，进而触发相关依赖对应的视图更新方法，最后达到模板原本的关联效果。

所以整个 vm 的核心，就是如何实现 observer, directive (parser), watcher 这三样东西。
