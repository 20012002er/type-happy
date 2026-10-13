import { createI18n } from 'vue-i18n';

// 导入语言包
import zhCN from './zh-CN';

export type MessageSchema = typeof zhCN;

// 创建i18n实例
const i18n = createI18n({
  legacy: false,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN
  }
});

export default i18n;