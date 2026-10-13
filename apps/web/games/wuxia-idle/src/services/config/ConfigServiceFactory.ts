/**
 * 配置服务工厂
 * 根据配置创建不同类型的配置服务实例
 */

import type { IConfigService, ConfigServiceConfig } from './types';
import { LocalConfigService, DEFAULT_LOCAL_CONFIG } from './LocalConfigService';

export class ConfigServiceFactory {
  private static instance: IConfigService | null = null;
  
  /**
   * 创建配置服务实例
   */
  static createConfigService(config?: Partial<ConfigServiceConfig>): IConfigService {
    const finalConfig: ConfigServiceConfig = {
      ...DEFAULT_LOCAL_CONFIG,
      ...config
    };
    
    switch (finalConfig.source) {
      case 'local':
        return new LocalConfigService(finalConfig);
      
      case 'remote':
        // TODO: 实现远程配置服务
        throw new Error('Remote config service not implemented yet');
      
      case 'hybrid':
        // TODO: 实现混合配置服务（本地+远程）
        throw new Error('Hybrid config service not implemented yet');
      
      default:
        return new LocalConfigService(finalConfig);
    }
  }
  
  /**
   * 获取单例配置服务实例
   */
  static getInstance(config?: Partial<ConfigServiceConfig>): IConfigService {
    if (!this.instance) {
      this.instance = this.createConfigService(config);
    }
    return this.instance;
  }
  
  /**
   * 重置单例实例
   */
  static resetInstance(): void {
    this.instance = null;
  }
}

/**
 * 默认配置服务实例
 */
export const configService = ConfigServiceFactory.getInstance();
