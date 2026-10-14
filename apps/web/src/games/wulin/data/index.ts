export { ITEMS, itemById, itemName } from './items'
export { SKILLS, skillById, skillName } from './skills'
export { NPCS, npcById, npcName } from './npcs'
export { SECTS, sectById } from './sects'
export { CHAPTERS, STORY_CHAPTERS, chapterById, VOLUME } from './chapters'
export { ORIGINS, originById } from './origins'

import { chapterById } from './chapters'
import { npcById } from './npcs'
import { skillById } from './skills'
import { sectById } from './sects'
import type { ChapterDef, NpcDef, SectDef, SkillDef } from '../types'

export function chapter(id: string): ChapterDef {
  const c = chapterById.get(id)
  if (!c) throw new Error(`chapter not found: ${id}`)
  return c
}

export function npc(id: string): NpcDef | undefined {
  return npcById.get(id)
}

export function skill(id: string): SkillDef | undefined {
  return skillById.get(id)
}

export function sect(id: string | null | undefined): SectDef | undefined {
  return id ? sectById.get(id) : undefined
}
