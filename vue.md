# VUE3

## Class的基本语法

### 实例属性的新写法
```javascript
class IncreasingCounter {
  constructor() {
    this._count = 0;
  }
  get value() {
    console.log('Getting the current value!');
    return this._count;
  }
  increment() {
    this._count++;
  }
}

class IncreasingCounter {
  _count = 0;
  get value() {
    console.log('Getting the current value!');
    return this._count;
  }
  increment() {
    this._count++;
  }
}
```

## Reflect

### Reflect对象的设计目的

* 将object对象的一些明显属于语言内部的方法（比如Object.defineProperty），放到Reflect对象上。现阶段，某些方法同时在Object和Reflect对象上部署，未来的新方法将只部署在Reflect对象上。也就是说，从Reflect对象上可以拿到语言内部的方法。
* 修改某些Object方法的返回结果，让其变得更合理。比如，Object.defineProperty(obj, name, desc)在无法定义属性时，会抛出一个错误，而Reflect.defineProperty(obj, name, desc)则会返回false。
* 让Object操作都变成函数行为。某些Object操作是命令式，比如name in obj和delete obj[name]，而Reflect.has(obj, name)和Reflect.deleteProperty(obj, name)让它们变成了函数行为。
* Reflect对象的方法与proxy对象的方法一一对应，只要是Proxy对象的方法，就能在Reflect对象上找到对应的方法。这就让Proxy对象可以方便地调研对应的Reflect方法，完成默认行为，作为修改行为的基础。也就算说，不管Proxy怎么修改默认行为，你总可以在Reflect上获取默认行为
```javascript
Proxy(target, {
  set: function (target, name, value, receiver) {
    var success = Reflect.set(target, name, value, receiver);
    if (success) {
      console.log('property ' + name + ' on ' + target + ' set to ' + value);
    } 
    return success;
  }
});
``` 

## ES6的代理模式 | Proxy

* proxy修改的是程序默认行为，就形同于在编程语言层面上做修改，属于元编程（meta programming）
* proxy译为代理，可以理解为在操作目标对象前架设一层代理，将所有本该我们手动编写的程序交由代理来处理，生活中也有许许多多的“proxy”，如代购，中介，因为他们所有的行为都不会直接触达目标

### 语法
* target要使用Proxy包装的目标对象（可以是任何类型的对象，包括原生对象，函数，甚至另一个代理）
* handler一个通常以函数作为属性的对象，用来定制拦截行为
```javascript
const proxy = new Proxy(target, handler);

const origin = {};
const obj = new Proxy(origin, {
  get: function (target, propKey, receiver) {
    return '10';
  }
});
```
* Handler对象常用的方法
![proxy方法](https://github.com/limeng1991/images/blob/main/vue/proxy_func.png?raw=true)
* 如果要访问的目标属性是不可写以及不可配置的，则返回的值必须与该目标属性的值相同
* 如果要访问的目标属性没有配置访问方法，即get方法是undefined的，则返回值必须为undefined
* proxy有一个唯一的静态方法，Proxy.revocable(target, handler),Proxy.revocable()方法可以用来创建一个可撤销的代理对象，该方法的返回值是一个对象，其结构为：{"proxy": proxy, "revoke": revoke}
1. proxy表示新生成的代理对象本身，和用一般方式new Proxy(target, handler)创建的代理对象没什么不同，只是它可以被撤销掉。
2. revoke撤销方法，调用的时候不需要加任何参数，就可以撤销掉和它一起生成的那个代理对象。
```javascript
const target = { name: 'vuejs' };
const { proxy, revoke } = Proxy.revocable(target, handler);
proxy.name // 正常取值输出vuejs
revoke() // 取值完成对proxy进行封闭，撤销代理
proxy.name // TypeError: Revoked
```
* Proxy的应用场景【校验器】
```javascript
const target = {
  _id: '1024',
  name: 'vuejs'
};
const validators = {
  name(val) {
    return typeof val === 'string';
  },
  _id(val) {
    return typeof val === 'number' && val > 1024;
  }
};
const createValidator = (target, validator) => {
  return new Proxy(target, {
    _validator: validator,
    set(target, propkey, value, proxy) {
      let validator = this._validator[propkey](value);
      if (validator) {
        return Reflect.set(target, propkey, value, proxy);
      } else {
        throw Error(`Cannot set ${propkey} to ${value}. Invalid type.`);
      }
    }
  })
}
const proxy = createValidator(target, validators);
proxy.name = 'vue-js.com' // vue-js.com
proxy.name = 10086 // Uncaught Error:
```

### Vue中的defineProperty

* Vue3之前的双向绑定都是通过defineProperty的getter，setter来实现的
```javascript
Object.defineProperty(obj, key, {
  enumerable: true,
  configurable: true,
  get: function reactiveGetter() {
    // ...
    if (Dep.target) {
      // 收集依赖
      dep.depend();
    }
    return value;
  },
  set: function reactiveSetter(newVal) {
    // ...
    // 通知视图更新
    dep.notify();
  }
});

```

* 数组变异，由于Javascript的限制，Vue不能检测以下数组的变动，当你利用索引直接设置一个数组项时，例如：vm.items[indexOfItem] = newValue
```javascript
const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
];
methodsToPatch.forEach(function (method) {
  // 缓存原生数组
  const original = arrayProto[method];
  // def使用Object.defineProperty重新定义属性
  def(arrayMethods, method, function mutator (...args) {
    // 调用原生数组的方法
    const result = original.apply(this, args);
    // ob就算observe实例observe才能响应式
    const ob = this.__ob__;
    let inserted;
    switch (method) {
      // push和unshift方法会增加数组的索引，但是新增的索
      // 引位需要手动observe的
      case 'push':
      case 'unshift':
        inserted = args;
        break;
      // 同理，splice的第三个参数，为新增的值，也需要手动
      // observe  
      case 'splice':
        inserted = args.slice(2);
        break;    
    }
    // 其余的方法都是在原有的索引上更新，初始化的时候已经
    // observe过了
    if (inserted) ob.observeArray(inserted);
    // dep通知所有的订阅者触发回调
    ob.dep.notify();
    return result;
  });
})
```

* 对比
1. Proxy作为新标准将受到浏览器厂商重点持续的性能优化
2. Proxy能观察的类型比defineProperty更丰富
3. Proxy不兼容IE，也没有polyfill，defineProperty能支持到IE9
4. Object.defineProperty是劫持对象的属性，新增元素需要再次defineProperty。而Proxy劫持的是整个对象，不需要做特殊处理
5. 使用defineProperty时，我们修改原来的obj对象就可以触发拦截，而使用proxy，就必须修改代理对象，即Proxy的实例才可以触发拦截

### WeakSet

* WeakSet对象是一些对象值的集合，并且其中的每个对象值都只能出现一次。在WeakSet的集合中是唯一的
* 与Set的区别
1. 与Set相比，WeakSet只能是对象的集合，而不能是任何类型的任意值。
2. WeakSet集合中对象的引用为弱引用。如果没有其他的对WeakSet中对象的引用，那么这些对象会被当成垃圾回收掉。这也意味着WeakSet中没有存储当前对象的列表。正因为这样，WeakSet是不可枚举的。

## TypeScript

### Typescript解决了什么问题

* 本质上是在Javascript上增加了一套静态类型系统（编译时进行类型分析），强调静态类型系统是为了和运行时的类型检查机制做区分
* 泛型的意义在于函数的重用性，设计原则希望组件不仅能够支持当前的数据类型，同时也能支持未来的数据类型。泛型可以保证入参跟返回值是相同类型的，它是一种特殊的变量，只用于表示类型而不是值
语法 <T>(arg: T):T 其中T为自定义变量
```typescript
interface Lengthwise {
  length: number;
}
function say<T extends Lengthwise>(arg: T): T {
  console.log(arg.length);
  return arg;
}
```
* 联合类型（Union Types），表示一个值可以是几种类型之一。我们用竖线|分隔每个类型，所有number|string|boolean表示一个值可以是number，string，或boolean
```typescript
export function defineComponent<Props, RawBindings = object>(
  setup: (
    props: Readonly<Props>,
    ctx: SetupContext
  ) => RawBindings | RenderFunction
): {
  new (): ComponentPublicInstance<
    Props,
    RawBindings,
    {},
    {},
    {},
    // public props
    VNodeProps & Props
  >
} & FunctionalComponent<Props>

// defineComponent一共有四个重载，这里省略三个
// implementation， close to no-op
export function defineComponent(options: unknown) {
  return isFunction(options) ? {setup: options} : options
}
```
* 类型断言（Type Assertion）可以用来手动指定一个值的类型

## CreateApp

### 顾名思义，CreateApp作为vue的启动函数，返回一个应用实例

```typescript
export const createApp = ((...args) => {
  const app = ensureRender().createApp(...args);
  if (__DEV__) {
    injectNativeTagCheck(app);
  }
  const { mount } = app;
  app.mount = (containerOrSelector: Element | string) : any => {
    const container = normalizeContainer(containerOrSelector);
    if (!container) return;
    const component = app._component;
    if (!isFunction(component) && !component.render && !component.template) {
      component.template = container.innerHTML;
    }
    // clear content before mounting
    container.innerHTML = '';
    const proxy = mount(container);
    container.removeAttribute('v-cloak');
    return proxy;
  }
  return app;
}) as CreateAppFunction<Element>;
```

### baseCreateRenderer

* baseCreateRenderer这个函数简直可以用庞大来形容，vnode diff patch均在这个方法中实现
```typescript
function baseCreateRenderer(
  options: RendererOptions,
  createHydrationFn?: typeof createHydrationFunctions
): any {
  const {
    insert: hostInsert,
    remove: hostRemove,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    createText: hostCreateText,
    createComment: hostCreateComment,
    setText: hostSetText,
    setElementText: hostSetElementText,
    parentNode: hostParentNode,
    nextSibling: hostNextSibling,
    setScopeId: hostSetScopeId = NOOP,
    cloneNode: hostCloneNode,
    insertStaticContent: hostInsertStaticContent
  } = options;

  // .... 此处省略两千行
  return {
    render,
    hydrate,
    createApp: createAppAPI(render, hydrate)
  }
}

export function createAppAPI<HostElement>(
  render: RootRenderFunction,
  hydrate?: RootHydrateFunction
): CreateAppFunction<HostElement> {
  return function createApp(rootComponent, rootProps = null) {
    if (rootProps != null && !isObject(rootProps)) {
      __DEV__ && warn(`root props passed to app.amount() must be an object.`);
      rootProps = null;
    }
    // 创建默认APP配置
    const context = createAppContext();
    const installedPlugins = new Set();
    let isMounted = false;
    const app: App = {
      _component: rootComponent as Component,
      _props: rootProps,
      _container: null,
      _context: context,

      get config() {
        return context.config;
      }

      set config(v) {
        if (__DEV__) {
          warn(
            `app.config cannot be replaced. Modify individual options instead.`
          );
        }
      },

      // 都是一些眼熟的方法
      use() {},
      mixin() {},
      component() {},
      directive() {},

      // mount我们拎出来讲
      mount() {},
      unmount() {},
      // ...
    }
    return app;
  }
}
```
```typescript
import { defineComponent } from 'vue';
const MyComponent = defineComponent({
  data () {
    return { count: 1 };
  },
  methods: {
    increment() {
      this.count++;
    }
  }
});
```

## h()

h代表的是hyperscript。它是HTML的一部分，表示的是超文本标记语言，当我们正在处理一个脚本的时候，在虚拟DOM节点中去使用它进行替换已成为一种惯例。

### 语法

```javascript
// type only
h('div')
// type + props
h('div', {})
// type + omit props + children
// Omit props does NOT support named slots
h('div', []) // array
h('div', 'foo') // text
h('div', h('br')) // vnode
h(Component, () => {}) // default slot
// type + props + children
h('div', {}, []) // array
h('div', {}, 'foo') // text
h('div', {}, h('br')) // vnode
h(Component, {}, () => {}) // default slot
h(Component, {}, {}) // named slots
// named slots without props requires explicit
// 'null' to avoid ambiguity
h(Component, null, {}) 
```

### 都干了些啥

h接收三个参数
* type元素的类型
* propsOrChildren数据对象，这里主要表示（props，attrs，dom props，class和style）
* children子节点
```typescript
export function h(type: any, propsOrChildren?: any, children?: any): VNode {
  if (arguments.length === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // single vnode without props
      if (isVNode(propsOrChildren)) {
        return createVNode(type, null, [propsOrChildren]);
      }
      // props without children
      return createVNode(type, propsOrChildren);
    } else {
      // omit props
      return createVNode(type, null, propsOrChildren);
    }
  } else {
    if (isVNode(children)) {
      children = [children];
    }
    return createVNode(type, propsOrChildren, children);
  }
}
```
* _createVNode做的事情也很简单
```typescript
function _createVNode(
  type: VNodeTypes | ClassComponent | typeof NULL_DYNAMIC_COMPONENT,
  props: (Data & VNodeProps) | null = null,
  children: unknown = null,
  // 更新标志
  patchFlag: number = 0,
  // 自定义属性
  dynamicProps: string[] | null = null,
  // 是否是动态节点，（v-if v-for）
  isBlockNode = false
): VNode {
  // type必传参数
  if (!type || type === NULL_DYNAMIC_COMPONENT) {
    if (__DEV__ && !type) {
      warn(`Invalid vnode type when creating vnode: ${type}.`);
    }
    type = Comment;
  }
  // Class 类型的type标准化
  // class component normalization.
  if (isFunction(type) && '__vccOpts' in type) {
    type = type.__vccOpts;
  }
  // class & style normalization
  if (props) {
    // props 如果是响应式，clone一个副本
    if (isProxy(props) || InternalObjectKey in props) {
      props = extend({}, props);
    }
    /**
     * 注意：只有当一个数组成员严格等于undefined，默认
     * 值才会生效。
     * let { foo: baz } = { foo: 'aaa' }
     * baz // "aaa"
     * */ 
    let { class: klass, style } = props;
    // 标准化class，支持string，array，object三种形式
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
    // 标准化style，支持array，object两种形式
    if (isObject(style)) {
      // reactive state objects need to be cloned 
      // since they are likely to be mutated
      if (isProxy(style) && !isArray(style)) {
        style = extend({}, style);
      } 
      props.style = normalizeStyle(style);
    }
  }
  // encode the vnode type information into a bitmap
  const shapeFlag = isString(type) 
    ? ShapeFlags.ELEMENT
    : __FEATURE_SUSPENSE__ && isSuspense(type)
      ? ShapeFlags.SUSPENSE
      : isTeleport(type)
        ? ShapeFlags.TELEPORT
        : isObject(type)
          ? ShapeFlags.STATEFUL_COMPONENT
          : isFunction(type)
            ? ShapeFlags.FUNCTIONAL_COMPONENT
            : 0;
  if (__DEV__ && shapeFlag && ShapeFlags.STATEFUL_COMPONENT && isProxy(type)) {
    type = toRaw(type);
    warn(
      `Vue received a Component which was made a ` +
      `reactive object. This can lead to ` +
      `unnecessary performance overhead, and ` +
      `should be avoided by marking the component `+
      `with \`markRaw\` or using \`shallowRef\` ` +
      `instead of \`ref\`. `,
      `\nComponent that was made reactive: `,
      type
    )
  }
  // 构造 VNode 模型
  const vnode: VNode = {
    __v_isVNode: true,
    __v_skip: true,
    type,
    props,
    key: props && normalizeKey(props),
    ref: props && normalizeRef(props),
    scopeId: currentScopeId,
    children: null,
    component: null,
    suspense: null,
    dirs: null,
    transition: null,
    el: null,
    anchor: null,
    target: null,
    targetAnchor: null,
    staticCount: 0,
    shapeFlag,
    patchFlag,
    dynamicProps,
    dynamicChildren: null,
    appContext: null
  };
  
  normalizeChildren(vnode, children);
  /**
   * presence of a patch flag indicates this node
   * needs patching on updates. component nodes 
   * also should always be patched, because even
   * if the component doesn't need to update, it
   * needs to persist the instance on to the next
   * vnode so that it can be properly unmounted
   * later.
   * */
  if (
    shouldTrack > 0 &&
    !isBlockNode &&
    currentBlock &&
    /**
     * the EVENTS flag is only for hydration and if 
     * it is the only flag, the vnode should not be 
     * considered dynamic due to handler caching.
     * */ 
    patchFlag !== PatchFlags.HYDRATE_EVENTS &&
    (patchFlag > 0 ||
      shapeFlag && ShapeFlags.SUSPENSE ||
      shapeFlag && ShapeFlags.TELEPORT ||
      shapeFlag && ShapeFlags.STATEFUL_COMPONENT ||
      shapeFlag && ShapeFlags.FUNCTIONAL_COMPONENT)
  ) {
    // 压入VNode栈
    currentBlock.push(vnode);
  }
  return vnode;
}
```

## nextTick

定义：在下次DOM更新循环结束之后执行延迟回调。在修改数据之后立即使用这个方法，获取更新后的DOM  

### JS运行机制

* 所有同步任务都在主线程上执行，形成一个执行栈（execution context stack）。
* 主线程之外，还存在一个“任务队列”（task queue）。只要异步任务有了运行结果，就在“任务队列”之中放置一个事件。
* 一旦“执行栈”中的所有同步任务执行完毕，系统就会读取“任务队列”，看看里面有哪些事件。那些对应的异步任务，于是结束等待状态，进入执行栈，开始执行。
* 主线程不断重复上面的第三步。

```typescript
const p = Promise.resolve();
export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p;
}
```

### queueJob and queuePostFlushCb

```typescript
const queue: (Job || null)[] = [];
export function queueJob(job: Job) {
  // 去重
  if (!queue.includes(job)) {
    queue.push(job);
    queueFlush();
  }
}

export function queuePostFlushCb(cb: Function | Function[]) {
  if (!isArray(cb)) {
    postFlushCbs.push(cb);
  } else {
    postFlushCbs.push(...cb);
  }
  queueFlush();
}
```

### queueFlush开启异步任务（nextTick）处理

```typescript
function queueFlush() {
  // 避免重复调用flushJobs
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    nextTick(flushJobs);
  }
}
```

### flushJobs

处理列队，先对列队进行排序，执行queue中的job，处理完后再处理postFlushCbs，如果队列没有被清空会递归调用flushJobs清空队列
```typescript
function flushJobs(seen?: CountMap) {
  isFlushPending = false;
  isFlushing = true;
  let job;
  if (__DEV__) {
    seen = seen || new Map();
  }
  /**
   * Sort queue before flush.
   * This ensures that:
   * 1. Components are updated from parent to child.
   * (because parent is always created before the 
   * child so its render effect will have smaller
   * priority number)
   * 2. If a component is unmounted during a parent 
   * component's update, its update can be skipped.
   * Jobs can never be null before flush starts,
   * since they are only invalidated during
   * execution of another flushed job.
   * */ 
  queue.sort((a, b) => getId(a!) - getId(b!))
  while ((job = queue.shift()) !== undefined) {
    if (job === null) {
      continue;
    }
    if (__DEV__) {
      // 强调seen不为空
      checkRecursiveUpdates(seen!, job);
    }
    callWithErrorHandling(job, null, ErrorCodes.SCHEDULER);
  }
  flushPostFlushCbs(seen);
  isFlushing = false;
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length || postFlushCbs.length) {
    flushJobs(seen);
  } 
}
```

* nextTick是vue中的更新策略，也是性能优化手段，基于JS执行机制实现
* vue中我们改变数据时不会立即触发视图，如果需要实时获取到最新的DOM，这个时候可以手动调用nextTick
* vue中采用异步更新策略，当监听到数据发生变化的时候不会立即去更新DOM，而是开启一个任务队列，并缓存在同一事件循环中发生的所有数据变更。这种做法带来的好处就算可以将多次数据更新合并成一次，减少操作DOM的次数，如果不采用这种方法，假设数据改变100次就要去更新100次DOM，而频繁的DOM更新是很好性能的

```typescript
import { noop } from 'shared/util'
import { handleError } from './error'
import { isIE, isIOS, isNative } from './env'
/**
 * 上面三行与核心代码关系不大，了解即可
 * noop表示一个无操作空函数，用作函数默认值，防止
 * 传入undefined导致报错
 * handleError错误处理函数
 * isIE, isIOS, isNative环境判断函数
 * isNative判断是否原生支持，如果通过第三方实现支持也会
 * 返回false
 * */ 
// nextTick最终是否以微任务执行
export let isUsingMicroTask = false;
// 存放调用nextTick时传入的回调函数
const callbacks = [];
// 标识当前是否有nextTick在执行，同一时间只能一个执行
let pending = false;
// 声明nextTick函数，接收一个回调函数和一个执行上下文
// 作为参数
export function nextTick(cb? Function, ctx?: Object) {
  let _resolve;
  // 将传入的回调函数存放到数组中，后面会遍历执行其中的回调
  callbacks.push(() => {
    /**
     * 对传入的回调进行try catch错误捕获
     * */ 
    if (cb) {
      try {
        cb.call(ctx);
      } catch (e) {
        handleError(e, ctx, 'nextTick');
      }   
    } else if (_resolve) {
      _resolve(ctx);
    }
  });
  /**
   * 如果当前没有在pending的回调，就执行timeFunc函数选择
   * 当前环境优先支持的异步方法
   * */ 
  if (!pending) {
    pending = true;
    timerFunc();
  }
  /**
   * 如果没有传入回调，并且当前环境支持promise，就返回
   * 一个promise
   * */ 
  if (!cb && typeof Promise !== 'undefined') {
    return new Promise(resolve => {
      _resolve = resolve;
    });
  }
}

/**
 * 判断当前环境优先支持的异步方法，优先选择微任务
 * 优先级Promise -> MutationObserver -> setImmediate
 * -> setTimeout
 * setTimeout最小延迟也要4ms，而setImmediate会在主线程
 * 执行完后立刻执行
 * setImmediate在IE10和node中支持
 * 多次调用nextTick时，timerFunc只会执行一次
 * */ 
let timerFunc;
// 判断当前环境是否支持promise
if (typeof Promise !== 'undefined' && isNative(Promise)) { // 支持promise
  const p = Promise.resolve();
  timerFunc = () => {
    // 用promise.then把flushCallbacks函数包裹成一个
    // 异步微任务
    p.then(flushCallbacks);
    if (isIOS) setTimeout(noop);
  }
  // 标记当前nextTick使用的微任务
  isUsingMicroTask = true;
  /**
   * 如果不支持promise，就判断是否支持MutationObserver
   * 不是IE环境，并且原生支持MutationObserver，那也是一个
   * 微任务
   * */ 
} else if (!isIE && typeof MutationObserver !== 'undefined' && (isNative(MutationObserver) || MutationObserver.toString() === '[object MutationObserverConstructor]')) {
  let counter = 1;
  // new一个MutationObserver类
  const observer = new MutationObserver(flushCallbacks);
  // 创建一个文本节点
  const textNode = document.createTextNode(String(counter));
  /**
   * 监听这个文本节点，当数据发生变化就执行flushCallbacks
   * */ 
  observer.observe(textNode, {characterData: true});
  timerFunc = () => {
    counter = (counter + 1) % 2;
    textNode.data = String(counter) // 数据更新
  }
  // 标记当前nextTick使用的微任务
  isUsingMircoTask = true;
  //判断当前环境是否原生支持setImmediate
} else if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  timerFunc = () => {
    setImmediate(flushCallbacks);
  }
} else {
  // 以上三种都不支持就选择setTimeout
  timerFunc = () => {
    setTimeout(flushCallbacks, 0);
  }
}

/**
 * 如果多次调用nextTick，会依次执行上面的方法，将nextTick
 * 的回调放在callbacks数组中，最后通过flushCallbacks函数
 * 遍历callbacks数组的拷贝并执行其中的回调
 * */ 
function flushCallbacks () {
  pending = false;
  // 拷贝一份
  const copies = callbacks.slice(0);
  // 清空callbacks
  callbacks.length = 0;
  // 遍历执行传入的回调
  for (let i = 0; i < copies.length; i++) {
    copies[i]();
  }
}
/**
 * 为什么要拷贝一份callbacks
 * callbacks.slice(0)将callbacks拷贝出来一份
 * 是因为考虑到nextTick回调中可能还会调用nextTick的情况
 * 如果nextTick回调中又调用了一次nextTick，则
 * 又会向callbacks中添加回调
 * nextTick回调中的nextTick应该放在下一轮执行，
 * 如果不将callbacks复制一份就可能一直循环 
 * */ 
```

## reactive整体概览

### 整体流程

![vue响应流程](https://github.com/limeng1991/images/blob/main/vue/reactive.png?raw=true)

### reactive

定义：接收一个普通对象然后返回该普通对象的响应式代理。响应式转换是“深层的”：会影响对象内部所有嵌套的属性。基于ES2015的Proxy实现，返回的代理对象不等于原始对象。

```typescript
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T> 
export function reactive(target: object) {
  // 如果目标对象是一个只读的响应数据，则直接返回目标对象
  if (target && (target as Target).__v_isReadonly) {
    return target
  }
  // 否则调用createReactiveObject创建observe
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers
  )
}

/**
 * Target 目标对象
 * isReadonly 是否只读
 * baseHandlers 基于类型的handlers
 * collectionHandlers 主要针对（set、map、weakSet、
 * weakMap）的handlers
 * */ 
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>
) {
  // 如果不是对象
  if (!isObject(target)) {
    // 在开发模式抛出警告，生产环境直接返回目标对象
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target;
  }
  /**
   * target is already a Proxy, return it.
   * exception: calling readonly() on a reactive 
   * object
  */
  // 如果目标对象已经是一个proxy直接返回
  if (target.__v_raw && !(isReadonly && target.__v_isReactive)) {
    return target;
  }
  // target already has corresponding Proxy
  if (
    hasOwn(target, isReadonly ? ReactiveFlags.readonly : ReactiveFlags.reactive)
  ) {
    return isReadonly ? target.__v_readonly : target.__v_reactive;
  }
  // only a whitelist of value types can be
  // observed.
  // 检查目标对象是否能被观察，不能直接返回
  if (!canObserve(target)) {
    return target;
  }
  // 使用Proxy创建observe
  const observed = new Proxy(
    target,
    collectionTypes.has(target.contructor) ?
      collectionHandlers : baseHandlers
  );
  // 打上相应标记
  def(
    target,
    isReadonly ? ReactiveFlags.readonly : ReactiveFlags.reactive,
    observed
  )
  return observed;
}

/**
 * 同时满足3个条即为可以观察的目标对象
 * 1. 没有打上__v_skip标记
 * 2. 是可以观察的值类型
 * 3. 没有被frozen
*/
const canObserve = (value: Target): boolean => {
  return (
    !value.__v_skip &&
    isObservableType(toRawType(value)) &&
    !Object.isFrozen(value)
  )
}

// 可以被观察的值类型
const isObservableType = /*#__PURE__*/ makeMap(
  'Object,Array,Map,Set,WeakMap,WeakSet'
)
```

## ref 

接受一个参数值并返回一个响应式且可改变的ref对象。ref对象拥有一个指向内部的单一属性.value
```javascript
const count = ref(0)
console.log(count.value) // 0
count.value++
console.log(count.value) // 1
```

ref跟reactive都是响应系统的核心方法，作为整个系统的入口。可以将ref看成reactive的一个变形版本，这是由于reactive内部采用Proxy来实现，而Proxy值接受对象作为入参，这才有了ref来解决值类型的数据响应，如果传入ref的是一个对象，内部也会调用reactive方法进行深层响应转换

### Ref是如何创建的

```typescript
export function ref(value?: unknown) {
  return createRef(value);
}
/**
 * @description:
 * @param {rawValue} 原始值
 * @param {shallow} 是否是浅观察
 * */ 
function createRef(rawValue: unknown, shallow = false) {
  // 如果已经是ref直接返回
  if (isRef(rawValue)) {
    return rawValue;
  }
  /**
   * 如果是浅观察直接观察，不是则将rawValue转成reactive,
   * reactive的定义在下方
   * */ 
  let value = shallow ? rawValue : convert(rawValue)
  // ref的结构
  const r = {
    // ref标识
    __v_isRef: true,
    get value() {
      // 依赖收集
      track(r, TrackOpTypes.GET, 'value')
      return value
    },
    set value(newVal) {
      if (hasChanged(toRaw(newVal), rawValue)) {
        rawValue = newVal;
        value = shallow ? newVal : convert(newVal);
        // 触发依赖
        trigger(
          r,
          TriggerOpTypes.SET,
          'value',
          __DEV__ ? { newValue: newVal } : void 0
        )
      }
    }
  }
  return r;
}

// 如果是对象则调用reactive，否则直接返回
const convert = <T extends unknown>(val: T): T => {
  isObject(val) ? reactive(val) : val;
}
```

## BaseHandlers

handler，音译为处理器，可以理解为处理器，在Proxy这篇文章中了解到Proxy(target, handlers)接收两个参数，target为目标对象，handlers就是针对target操作的一系列行为同时做一些处理

### 正文

在basehandlers中包含了四种handler

* mutableHandlers 可变处理
* readonlyHandlers 只读处理
* shallowReactiveHandlers 浅观察处理
* shallowReadonlyHandlers 浅观察 && 只读处理

### mutableHandlers

```typescript
// 定义
export const mutableHandlers: ProxyHandler<object> = {
  get, // 用于拦截对象的读取属性操作
  set, // 用于拦截对象的设置属性操作
  deleteProperty, // 用于拦截对象的删除属性操作
  has, // 检查一个对象是否拥有某个属性
  ownKeys 
  // 针对getOwnPropertyNames，getOwnPropertySymbols,
  // keys的代理方法
}

/**
 * @description: 用于拦截对象的删除属性操作
 * @param {target} 目标对象
 * @param {key} 键值
 * @return {Boolean} 
 * */ 
function deleteProperty(target: object, key: string | symbol): boolean {
  // hasOwn的实现放下方了，检查一个对象是否包含当前key
  const hadKey = hasOwn(target, key);
  const oldValue = (target as any)[key];
  // Reflect作用在于完成目标对象的默认，这里即指删除
  const result = Reflect.deleteProperty(target, key)
  // 如果该值被成功删除则调用trigger，
  // trigger为effect里的方法，effect为reactive的核心
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result;
}

/**
 * @desciption: 检查一个对象是否拥有某个属性
 * @param {target} 目标对象
 * @param {key} 键值
 * @return {Boolean} 
 * */ 
function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key);
  // track 也为effect的方法，effect为reactive的核心
  track(target, TrackOpTypes.HAS, key)
  return result;
}

// 返回一个有目标对象自身的属性键组成的数组
function ownKeys(target: object): (string | number |symbol)[] {
  track(target, TrackOpTypes.ITERATE, ITERATE_KEY)
  return Reflect.ownKeys(target)
}

const hasOwnProperty = Object.prototype.hasOwnProperty;
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

const set = /*#__PURE__*/ createSetter()
/**
 * @description: 拦截对象的设置属性操作
 * @param {shallow} 是否是浅观察
 * */ 
function createSetter(shallow = false) {
  /**
   * @description:
   * @param {target} 目标对象
   * @param {key} 设置的属性的名称
   * @param {value} 要改变的属性值
   * @param {receiver} 如果遇到setter，receiver则为
   * setter调用时的this值
   * */ 
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    const oldValue = (target as any)[key]
    // 如果模式不是浅观察
    if (!shallow) {
      value = toRaw(value)
      /**
       * 并且目标对象不是数组，旧值是ref，新值不是ref，则
       * 直接赋值
       * */ 
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true
      }
    } else {
      /**
       * in shallow mode, objects are set as-is 
       * regardless of reactive or not 【在浅层
       * 模式下，无论是否反应，对象都按原样设置】
       * */ 
    }
    // 检查对象是否有这个属性
    const hasKey = hasOwn(target, key)
    // 赋值
    const result = Reflect.set(target, key, value, receiver)
    /**
     * don't trigger if target is something up in 
     * the prototype chain of original
     * */ 
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // 如果不存在则trigger ADD
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        // 存在则trigger SET
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result;
  }
}

const get = /*#__PURE__*/ createGetter()
/**
 * @description: 用于拦截对象的读取属性操作
 * @param {isReadonly} 是否只读
 * @param {shallow} 是否浅观察
 * */ 
function createGetter(isReadonly = false, shallow = false) {
  /**
   * @description:
   * @param {target} 目标对象
   * @param {key} 需要获取的值的键值
   * @param {receiver} 如果遇到setter， receiver则
   * 为setter调用时的this值
   * */ 
  return function get(target: object, key: string | symbol, receiver: object) {
    /**
     * ReactiveFlags是在reactive中声明的枚举值，如果key
     * 是枚举值则直接返回对应的布尔值
     * */ 
    if (key === ReactiveFlags.isReactive) {
      return !isReadonly;
    } else if (key === ReactiveFlags.isReadonly) {
      return isReadonly;
    } else if (key === ReactiveFlags.raw) {
      // 如果key是raw则直接返回目标对象
      return target;
    }
    const targetIsArray = isArray(target)
    /**
     * 如果目标对象是数组并且key属于三个方法之一
     * ['includes', 'indexOf', 'lastIndexOf'],
     * 即触发了这三个操作之一
     * */ 
    if (targetIsArray && hasOwn(arrayInstrumentations, key)) {
      return Reflect.get(arrayInstrumentations, key, receiver)
    }
    const res = Reflect.get(target, key, receiver)
    /**
     * 如果key是symbol内置方法，或者访问的是原型对象，
     * 直接返回结果，不收集依赖
     * */ 
    if (isSymbol(key) && builtInSymbols.has(key) || key === '__proto__') {
      return res
    }
    /**
     * 如果是浅观察并且不为只读则调用track Get，并返回结果
     * */ 
    if (shallow) {
      !isReadonly && track(target, TrackOpTypes.GET, key)
      return res
    }
    // 如果get的结果是ref
    if (isRef(res)) {
      /**
       * 目标对象为数组并且不为只读调用track Get
       * 并返回结果 
       * */ 
      if (targetIsArray) {
        !isReadonly && track(target, TrackOpTypes.GET, key)
        return res
      } else {
        /**
         * ref unwrapping, only for Objects, not
         * for Arrays.
        */
        return res.value
      }
    }
    // 目标对象不为只读则调用track Get
    !isReadonly && track(target, TrackOpTypes.GET, key)
    /**
     * 由于proxy只能代理一层，所以target[key]的值如果是
     * 对象，就继续对其进行代理
     * */ 
    return isObject(res) 
      ? isReadonly
        ? // need to lazy access readonly and 
          // reactive here to avoid circular 
          // dependency
          readonly(res)
        : reactive(res)
      : res    
  }
}

const arrayInstrumentations: Record<string, Function> = {};['includes', 'indexOf', 'lastIndexOf'].forEach(key => {
  arrayInstrumentations[key] = function(...args: any[]): any {
    const arr = toRaw(this) as any
    for (let i = 0, l = (this as any).length; i < l;i++) {
      track(arr, TrackOpTypes.GET, i + '')
    }
    /**
     * we run the method using the original args
     * first (which may be reactive)
    */
    const res = arr[key](...args)
    if (res === -1 || res === false) {
      /**
       * if that didn't work, run it again using
       * raw values.
      */
      return arr[key](...args.map(toRaw))
    } else {
      return res
    }
  }
})
```

## effect 

effect作为reactive的核心，主要负责收集依赖，更新依赖

### 正文

effect接收两个参数
* fn 回调函数
* options 参数

```typescript
export interface ReactiveEffectOptions {
  lazy?: boolean // 是否延迟触发effect
  computed?: boolean // 是否为计算属性
  scheduler?: (job: ReactiveEffect) => void
  onTrack?: (event: DebuggerEvent) => void //追踪触发
  onTrigger?: (event: DebuggerEvent) => void
  onStop?: () => void // 停止监听时触发
}

export function effect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect<T> {
  // 如果已经是‘effect’先重置为原始对象
  if (isEffect(fn)) {
    fn = fn.raw
  }
  // 创建‘effect’
  const effect = createReactiveEffect(fn, options)
  // 如果没有传入lazy则直接执行一次‘effect’
  if (!options.lazy) {
    effect()
  } 
  return effect
} 

function createReactiveEffect<T = any>(
  fn: (...args: any[]) => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  const effect = function reactiveEffect(...args: unknown[]): unknown {
    // 没有激活，说明我们调用了effect stop函数
    if (!effect.active) {
      // 如果没有调度者，直接返回，否则直接执行fn
      return options.scheduler ? undefined : fn(...args)
    }
    // 判断effectStack中有没有effect，如果在则不处理
    if (!effectStack.includes(effect)) {
      // 清除effect依赖，定义在下方
      cleanup(effect)
      try {
        // 开始重新收集依赖
        enableTracking()
        // 压入Stack
        effectStack.push(effect)
        // 将activeEffect当前effect
        activeEffect = effect
        return fn(...args)
      } finally {
        // 完成后将effect弹出
        effectStack.pop()
        // 重置依赖
        resetTracking()
        // 重置activeEffect
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  } as ReactiveEffect
  effect.id = uid++ // 自增id，effect唯一标识
  effect._isEffect = true // 是否是effect
  effect.active = true // 是否激活
  effect.raw = fn // 挂载原始对象
  effect.deps = [] // 当前effect的dep数组
  effect.options = options // 传入的options
  return effect;
}
const effectStack: ReactiveEffect[] = []
/**
 * 每次effect运行都会重新收集依赖，deps是effect的依赖
 * 数组，需要全部清空
 * */ 
function cleanup(effect: ReactiveEffect) {
  const { deps } = effect;
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

/**
 * @description:
 * @param {target} 目标对象
 * @param {type} 收集的类型，函数的定义在下方
 * @param {key} 触发track的object的key
 * */ 
export function track(target: object, type: TrackOpTypes, key: unknown) {
  // activeEffect为空代表没有依赖，直接return
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  /**
   * targetMap依赖管理中心，用于收集依赖和触发依赖
   * 检查targetMap中有没有当前target
   * */ 
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    // 没有则新建一个
    targetMap.set(target, (depsMap = new Map()))
  }
  /**
   * deps来收集依赖函数，当监听的key值发生变化时，触发
   * dep中的依赖函数
   * */ 
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
    // 开发环境会触发onTrack，仅用于调试
    if (__DEV__ && activeEffect.options.onTrack) {
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key
      })
    }
  }
}

// get、has、iterate三种类型的读取对象会触发track
export const enmu TrackOpTypes {
  GET = 'get',
  HAS = 'has',
  ITERATE = 'iterate'
}  

export function triiger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  const depsMap = targetMap.get(target)
  // 依赖管理中没有，代表没有收集过依赖，直接返回
  if (!depsMap) {
    // never been tracked
    return
  }
  /**
   * 对依赖进行分类
   * effects代表普通依赖
   * computedRunners为计算属性依赖
   * 都是Set结构，避免重复收集
   * */ 
  const effects = new Set<ReactiveEffect>()
  const computedRunners = new Set<ReactiveEffect>()
  const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        // 避免重复收集
        if (effect !== activeEffect || !shouldTrack) {
          // 计算属性依赖
          if (effect.options.computed) {
            computedRunners.add(effect)
          } else {
            // 普通属性依赖
            effects.add(effect)
          }
        } else {
          /**
           * the effect mutated its own dependency
           * during its execution. this can be 
           * caused by operations like foo.value++
           * do not trigger or we end in an infinite
           * loop
           * */ 
        }
      })
    }
  }
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    depsMap.forEach(add)
  } else if (key === 'length' && isArray(target)) {
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue && number)) {
        add(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      add(depsMap.get(key))
    }
    // also run for iteration key on ADD 
    // | DELETE | Map.SET
    const isAddOrDelete =
      type === TriggerOpTypes.ADD ||
        (type === TriggerOpTypes.DELETE && !isArray(target))
    if (
      isAddOrDelete ||
      (type === TriggerOpTypes.SET && target instanceof Map)
    ) {
      add(depsMap.get(isArray(target) ? 'length' : ITERATE_KEY))
    }  
    if (isAddOrDelete && target instanceof Map) {
      add(depsMap.get(MAP_KEY_ITERATE_KEY))
    }  
  }
  const run = (effect: ReactiveEffect) => {
    if (__DEV__ && effect.options.onTrigger) {
      effect.options.onTrigger({
        effect,
        target,
        key,
        type,
        newValue,
        oldValue,
        oldTarget
      })
    }
    // 如果scheduler存在则调用scheduler，计算属性
    // 拥有scheduler
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }
  /**
   * important: computed effects must be run first
   * so that computed getters can be invalidated 
   * before any normal effects that depend on them
   * are run.
   * */ 
  computedRunners.forEach(run)
  effects.forEach(run)
}
```

## computed

传入一个getter函数，返回一个默认不可手动修改的ref对象

```typescript
const count = ref(1)
const plusOne = computed(() => count.value + 1)
console.log(plusOne.value) // 2
plusOne.value++ // 错误！
```

### 正文

计算属性，可能会依赖其他reactive的值，同时会延迟和缓存计算值

```typescript
export function computed<T>(
  getterOrOptions: ComputedGetter<T> | WritableComputedOptions<T>
) {
  let getter: ComputedGetter<T>
  let setter: ComputedSetter<T>
  // 如果传入是function说明是只读computed
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = __DEV__
      ? () => {
        console.warn('Write operation failed: computed value is readonly')
      }
      : NOOP
  } else {
    // 不是方法说明是自定义的getter setter
    getter = getterOrOptions.get
    setter = setterOrOptions.set
  }
  let dirty = true
  let value: T
  let computed: ComputedRef<T>
  /**
   * 创建effect，我们在看effect源码时知道了传入lazy代表
   * 不会理解执行，computed表明computed上游依赖改变的
   * 时候，会优先trigger runner effect，scheduler
   * 表示effect trigger的时候会调用scheduler而不是
   * 直接调用effect
   * */ 
  const runner = effect(getter, {
    lazy: true,
    /**
     * mark effect as computed so that it gets
     * priority during trigger
    */
    computed: true,
    scheduler: () => {
      // 在触发更新时把dirty置为true，不会立即更新
      if (!dirty) {
        dirty = true
        trigger(computed, TriggerOpTypes.SET, 'value')
      }
    }
  })
  // 构造一个computed返回
  computed = {
    __v_isRef: true,
    // expose effect so computed can be stopped
    effect: runner,
    get value() {
      // dirty为true，get操作时，执行effect获取最新值
      if (dirty) {
        value = runner()
        dirty = false
      }
      // dirty为false，表示值未更新，直接返回
      track(computed, TrackOpTypes.GET, 'value')
      return value
    },
    set value(newValue: T) {
      setter(newValue)
    }
  } as any
  return computed
}
```

