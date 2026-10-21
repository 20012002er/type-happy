import { createApp, isRef, toRaw } from 'vue'
import { createPinia } from 'pinia'
import router from '@/router'
import App from './App.vue'
import './app.css'

const app = createApp(App)
const pinia = createPinia()

/** 深拷贝状态值：先 toRaw 脱掉响应式代理，支持数组、Set、Map、Date 与普通对象 */
const cloneState = (value: unknown): unknown => {
  const raw: unknown = toRaw(value)
  if (isRef(raw)) return cloneState(raw.value)
  if (raw === null || typeof raw !== 'object') return raw
  if (Array.isArray(raw)) return raw.map(item => cloneState(item))
  if (raw instanceof Set) return new Set(Array.from(raw, item => cloneState(item)))
  if (raw instanceof Map) return new Map(Array.from(raw, ([key, item]) => [cloneState(key), cloneState(item)]))
  if (raw instanceof Date) return new Date(raw.getTime())
  return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, cloneState(item)]))
}

// 为 setup store 添加 $reset()（Pinia 默认仅 option store 支持 $reset）。
// setup store 的状态树里存的是 ref：快照要经响应式代理读出解包后的值，
// 重置时再经代理逐个写回，才会落到原 ref 的 .value 上。
pinia.use(({ store }) => {
  const state = store.$state as Record<string, unknown>
  const initialState = Object.fromEntries(Object.keys(state).map(key => [key, cloneState(state[key])]))
  store.$reset = () => {
    store.$patch($state => {
      const target = $state as Record<string, unknown>
      for (const [key, value] of Object.entries(initialState)) target[key] = cloneState(value)
    })
  }
})

app.use(pinia)
app.use(router)
app.mount('#app')
