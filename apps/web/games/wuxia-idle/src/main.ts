import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import i18n from './locales';

// 全局样式
import './assets/styles/global.css';

// 配置服务初始化
import { initializeLevelExpConfig } from './config/levelExpConfig';
import { tickService } from '@/services/runtime/TickService';
import { registerAllTickHandlers } from '@/services/runtime/registerAllTickHandlers';

const app = createApp(App);

// 安装插件
app.use(createPinia());
app.use(router);
app.use(i18n);

// 初始化应用
async function initializeApp() {
  try {
    // 初始化配置服务
    console.log('正在初始化游戏配置...');
    await initializeLevelExpConfig();
    console.log('游戏配置初始化完成');
    
    // 挂载应用
    app.mount('#app');
    console.log('应用启动完成');

    // 仅启动 TickService，并统一注册所有业务处理器
    await registerAllTickHandlers();
    tickService.start();
  } catch (error) {
    console.error('应用初始化失败:', error);
    
    // 即使配置加载失败，也要挂载应用（使用默认配置）
    console.warn('使用默认配置启动应用');
    app.mount('#app');
  }
}

// 启动应用
initializeApp();
