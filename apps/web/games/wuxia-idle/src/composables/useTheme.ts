import { useI18n } from 'vue-i18n';
import { CURRENT_THEME } from '@/config/themes';

export const useTheme = () => {
  const { t } = useI18n();
  
  // 获取游戏文案
  const getGameText = (key: string) => {
    return t(key);
  };
  
  // 初始化主题
  const initTheme = () => {
    // 设置页面标题
    document.title = t('world.name');
  };
  
  return {
    currentTheme: CURRENT_THEME,
    getGameText,
    initTheme
  };
};
