import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createHead } from '@unhead/vue/client'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App).use(createHead()).use(createPinia()).use(router).mount('#app')
