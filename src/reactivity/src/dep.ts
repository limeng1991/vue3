// 用于存储所有的 effect 对象
export function createDep(effects?) {
  /**
   * ES6提供了新的数据结构Set。它类似于数组，但是成员的值
   * 都是唯一的，没有重复的值。
   * */ 
  const dep = new Set(effects);
  return dep;
}
