/**
 * 内容异常停用注册表：发现坏题（如选择题多解）时先停用模板并换题，再修正后续版本。
 * 停用只影响新题生成与组卷筛选；历史快照仍按原内容解析，不追溯扣回历史奖励。
 */
export interface DisabledMathTemplate {
  templateId: string
  reason: string
}

const disabledTemplates = new Map<string, string>()

export function disableMathTemplate(templateId: string, reason: string): void {
  if (templateId.trim().length === 0) throw new Error('停用模板 ID 不能为空')
  if (reason.trim().length === 0) throw new Error('停用原因不能为空')
  if (disabledTemplates.has(templateId)) throw new Error(`模板 ${templateId} 已停用`)
  disabledTemplates.set(templateId, reason)
}

export function reenableMathTemplate(templateId: string): void {
  if (!disabledTemplates.delete(templateId)) throw new Error(`模板 ${templateId} 并未停用`)
}

export function isMathTemplateDisabled(templateId: string): boolean {
  return disabledTemplates.has(templateId)
}

export function getDisabledMathTemplates(): readonly DisabledMathTemplate[] {
  return [...disabledTemplates.entries()].map(([templateId, reason]) => ({ templateId, reason }))
}
