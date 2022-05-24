// 组件的类型
/**
 * 1. 左移shift a << b 将a的二进制串向左移动b位，右边移入0.
 * 2. 算术右移 a >> b 把a的二进制表示向右移动b位，丢弃被移出的所有位。
 * 1 << 2 0001 0100
 * */ 
export const enum ShapeFlags {
  // 最后要渲染的 element 类型
  ELEMENT = 1,
  // 组件类型
  STATEFUL_COMPONENT = 1 << 2,
  // vnode 的 children 为 string 类型
  TEXT_CHILDREN = 1 << 3,
  // vnode 的 children 为数组类型
  ARRAY_CHILDREN = 1 << 4,
  // vnode 的 children 为 slots 类型
  SLOTS_CHILDREN = 1 << 5
}
  