/**
 * MartialService
 * - 学习秘籍：记录武学ID，按 movePools 抽取随机招数加入玩家
 * - 查询：返回玩家可用招数列表
 */

import type { Player } from '@/types/player';
import type { Move } from '@/types/martial';
import { MartialArtConfigService, MoveConfigService } from './config/MartialConfigServices';

export class MartialService {
  /** 学习一本秘籍，返回新增的招数ID列表 */
  async learnArt(player: Player, artId: string): Promise<string[]> {
    const art = await MartialArtConfigService.getArt(artId);
    if (!art) return [];
    const martial = (player.martial ??= { learnedArtIds: [], learnedMoveIds: [], equipped: {}, proficiency: {} } as any);
    if (!martial.learnedArtIds.includes(artId)) {
      martial.learnedArtIds.push(artId);
    }

    const gained: string[] = [];
    const pools = art.movePools || [];
    for (const pool of pools) {
      const min = Math.max(1, pool.minRolls ?? 1);
      const max = Math.max(min, pool.maxRolls ?? min);
      const rolls = Math.floor(min + Math.random() * (max - min + 1));
      for (let i = 0; i < rolls; i++) {
        if ((pool.moveIds || []).length === 0) continue;
        const idx = Math.floor(Math.random() * pool.moveIds.length);
        const picked = pool.moveIds[idx];
        if (!martial.learnedMoveIds.includes(picked)) {
          martial.learnedMoveIds.push(picked);
          gained.push(picked);
        }
      }
    }
    return gained;
  }

  /** 获取已学招数（不做能量/等级过滤） */
  async getLearnedMoves(player: Player): Promise<Move[]> {
    const ids = player.martial?.learnedMoveIds || [];
    const moves: Move[] = [];
    for (const id of ids) {
      const mv = await MoveConfigService.getMove(id);
      if (mv) moves.push(mv);
    }
    return moves;
  }

  /** 获取玩家可用的招数（按等级/能量/需求简单过滤） */
  async getUsableMoves(player: Player): Promise<Move[]> {
    const ids = player.martial?.learnedMoveIds || [];
    const usable: Move[] = [];
    for (const id of ids) {
      const mv = await MoveConfigService.getMove(id);
      if (!mv) continue;
      if (typeof mv.minLevel === 'number' && player.stats.level < mv.minLevel) continue;
      if (typeof mv.energyCost === 'number' && player.stats.energy < mv.energyCost) continue;
      usable.push(mv);
    }
    return usable;
  }

  /** 直接解锁指定招数（用于天赋树等系统） */
  async unlockMove(player: Player, moveId: string): Promise<Move | null> {
    const move = await MoveConfigService.getMove(moveId);
    if (!move) {
      console.warn('[MartialService] 尝试解锁未知招数:', moveId);
      return null;
    }
    const martial = (player.martial ??= {
      learnedArtIds: [],
      learnedMoveIds: [],
      equipped: {},
      proficiency: {}
    });
    if (!martial.learnedMoveIds.includes(moveId)) {
      martial.learnedMoveIds.push(moveId);
      return move;
    }
    return move;
  }
}

export const martialService = new MartialService();


