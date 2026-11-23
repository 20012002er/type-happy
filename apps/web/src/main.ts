import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import router from './router'
import './style.css'

const mountPoint = document.querySelector<HTMLElement>('#app')!
const prerenderedHeight = mountPoint.firstElementChild ? mountPoint.scrollHeight : 0
// 等待异步路由期间保留快照高度，避免挂载时页脚进入首屏造成 CLS。
if (prerenderedHeight > 0) mountPoint.style.minHeight = `${prerenderedHeight}px`

const app = createApp(App).use(createHead()).use(createPinia()).use(router)
await router.isReady()
app.mount(mountPoint)

if (prerenderedHeight > 0) mountPoint.style.minHeight = ''
