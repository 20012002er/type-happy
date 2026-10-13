/**
 * 叙事模板配置服务
 * 负责加载和管理叙事日志模板
 */

import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';
import type { NarrativeTemplate, NarrativeTemplatesFile } from '@/types/narrative';

export class NarrativeTemplateService {
  private static cache: NarrativeTemplatesFile | null = null;

  /**
   * 加载所有模板配置
   */
  static async loadTemplates(): Promise<NarrativeTemplatesFile> {
    if (NarrativeTemplateService.cache) {
      return NarrativeTemplateService.cache;
    }

    try {
      const data = await configService.loadConfig<NarrativeTemplatesFile>(
        ConfigType.NARRATIVE_TEMPLATES
      );
      NarrativeTemplateService.cache = data;
      return data;
    } catch (error) {
      console.error('[NarrativeTemplateService] 模板加载失败:', error);
      // 返回空配置
      return {
        version: '1.0.0',
        lastUpdated: '',
        templates: {},
        synonyms: {}
      };
    }
  }

  /**
   * 获取指定事件类型的模板列表
   */
  static async getTemplates(eventType: string): Promise<NarrativeTemplate[]> {
    const data = await NarrativeTemplateService.loadTemplates();
    return data.templates[eventType] || [];
  }

  /**
   * 根据权重随机选择一个模板
   */
  static async getRandomTemplate(
    eventType: string,
    context?: Record<string, unknown>
  ): Promise<NarrativeTemplate | null> {
    const templates = await NarrativeTemplateService.getTemplates(eventType);
    
    if (templates.length === 0) {
      return null;
    }

    // 过滤符合条件的模板
    const validTemplates = templates.filter(t => 
      NarrativeTemplateService.matchConditions(t, context)
    );

    if (validTemplates.length === 0) {
      // 如果没有符合条件的，使用所有模板
      return NarrativeTemplateService.selectByWeight(templates);
    }

    return NarrativeTemplateService.selectByWeight(validTemplates);
  }

  /**
   * 检查模板条件是否匹配
   */
  private static matchConditions(
    template: NarrativeTemplate,
    context?: Record<string, unknown>
  ): boolean {
    if (!template.conditions || !context) {
      return true;
    }

    const { conditions } = template;

    if (conditions.isCrit !== undefined && conditions.isCrit !== context.isCrit) {
      return false;
    }
    if (conditions.isLastEnemy !== undefined && conditions.isLastEnemy !== context.isLastEnemy) {
      return false;
    }
    if (conditions.isBossWave !== undefined && conditions.isBossWave !== context.isBossWave) {
      return false;
    }
    if (conditions.hpBelow !== undefined) {
      const hpPercent = context.hpPercent as number | undefined;
      if (hpPercent === undefined || hpPercent >= conditions.hpBelow) {
        return false;
      }
    }

    return true;
  }

  /**
   * 根据权重随机选择模板
   */
  private static selectByWeight(templates: NarrativeTemplate[]): NarrativeTemplate {
    const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
    let random = Math.random() * totalWeight;

    for (const template of templates) {
      random -= template.weight;
      if (random <= 0) {
        return template;
      }
    }

    return templates[0];
  }

  /**
   * 获取同义词列表
   */
  static async getSynonyms(): Promise<Record<string, string[]>> {
    const data = await NarrativeTemplateService.loadTemplates();
    return data.synonyms;
  }

  /**
   * 获取指定词的随机同义词
   */
  static async getRandomSynonym(word: string): Promise<string> {
    const synonyms = await NarrativeTemplateService.getSynonyms();
    const wordSynonyms = synonyms[word];
    
    if (!wordSynonyms || wordSynonyms.length === 0) {
      return word;
    }

    return wordSynonyms[Math.floor(Math.random() * wordSynonyms.length)];
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    NarrativeTemplateService.cache = null;
  }
}

// 导出便捷方法
export const {
  loadTemplates,
  getTemplates: getNarrativeTemplates,
  getRandomTemplate,
  getSynonyms,
  getRandomSynonym
} = NarrativeTemplateService;
