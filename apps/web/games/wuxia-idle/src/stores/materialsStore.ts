import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface MaterialStack { 
  id: string; 
  name?: string; 
  qty: number;
  // 别名，为了兼容性
  quantity?: number;
}

export const useMaterialsStore = defineStore('materials', () => {
  const stacks = ref<Record<string, MaterialStack>>({});

  const add = (id: string, qty = 1, name?: string) => {
    const s = stacks.value[id] || { id, name, qty: 0 };
    s.qty += qty;
    if (name) s.name = name;
    stacks.value[id] = s;
  };

  const has = (id: string, qty = 1) => {
    const s = stacks.value[id];
    return !!s && s.qty >= qty;
  };

  const consume = (id: string, qty = 1) => {
    if (!has(id, qty)) return false;
    stacks.value[id].qty -= qty;
    
    // 如果数量为0或负数，删除该材料堆叠
    if (stacks.value[id].qty <= 0) {
      delete stacks.value[id];
    }
    
    return true;
  };

  /**
   * 获取材料信息
   * 返回的对象包含 quantity 别名以兼容不同的使用场景
   */
  const getMaterial = (id: string): (MaterialStack & { quantity: number }) | null => {
    const s = stacks.value[id];
    if (!s) return null;
    return {
      ...s,
      quantity: s.qty // 添加 quantity 别名
    };
  };

  /**
   * 添加材料（别名方法，使用 quantity 参数名）
   */
  const addMaterial = (id: string, quantity = 1, name?: string) => {
    return add(id, quantity, name);
  };

  /**
   * 移除材料（别名方法，使用 quantity 参数名）
   */
  const removeMaterial = (id: string, quantity = 1) => {
    return consume(id, quantity);
  };

  const list = () => Object.values(stacks.value);

  /**
   * 获取保存数据
   */
  const getSaveData = (): Record<string, MaterialStack> => {
    return JSON.parse(JSON.stringify(stacks.value));
  };

  /**
   * 从保存数据加载
   */
  const loadFromSave = (saveData: Record<string, MaterialStack>): void => {
    stacks.value = saveData || {};
  };

  return { 
    stacks, 
    add, 
    has, 
    consume, 
    list, 
    getSaveData, 
    loadFromSave,
    // 新增的别名方法
    getMaterial,
    addMaterial,
    removeMaterial
  };
});
