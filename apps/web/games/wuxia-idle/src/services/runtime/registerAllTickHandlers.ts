import { registerStaminaTickHandler, staminaService } from '@/services/staminaService';

export async function registerAllTickHandlers() {
  registerStaminaTickHandler();
  // 立即初始化各自状态，避免初始渲染出现 0/0
  await staminaService.initGaugesIfNeeded();
}
