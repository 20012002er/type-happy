/**
 * 武学/招数配置服务
 * - 复用统一 configService 的加载/缓存能力
 */

import { configService } from './ConfigServiceFactory';
import { ConfigType } from './types';
import type {
  MovesFile,
  MartialArtsFile,
  Move,
  MartialArt,
  TalentTreeConfig,
  TalentNode
} from '@/types/martial';

export class MoveConfigService {
  private static cache: MovesFile | null = null;

  static async load(): Promise<MovesFile> {
    if (this.cache) return this.cache;
    const cfg = await configService.loadConfig<MovesFile>(ConfigType.MOVES);
    const mergedMoves: Record<string, Move> = { ...(cfg.moves || {}) };

    if (cfg.talentTree) {
      Object.values(cfg.talentTree.nodes).forEach(node => {
        const effectMove = node.effect?.move;
        if (effectMove) {
          mergedMoves[effectMove.id] = effectMove;
        }
      });
    }

    this.cache = {
      ...cfg,
      moves: mergedMoves
    };
    return this.cache;
  }

  static async getMove(id: string): Promise<Move | null> {
    const cfg = await this.load();
    return cfg.moves[id] ?? null;
  }

  static clear(): void {
    this.cache = null;
  }
}

export class TalentTreeConfigService {
  private static cache: TalentTreeConfig | null = null;

  static async load(): Promise<TalentTreeConfig | null> {
    if (this.cache) return this.cache;
    const cfg = await MoveConfigService.load();
    if (!cfg.talentTree) return null;
    this.cache = cfg.talentTree;
    return this.cache;
  }

  static clear(): void {
    this.cache = null;
  }

  static async getTree(): Promise<TalentTreeConfig | null> {
    return this.load();
  }

  static async getAllNodes(): Promise<TalentNode[]> {
    const tree = await this.load();
    if (!tree) return [];
    return Object.values(tree.nodes);
  }

  static async getNode(id: string): Promise<TalentNode | null> {
    const tree = await this.load();
    return tree?.nodes[id] ?? null;
  }

  static async getConnections(): Promise<Array<[string, string]>> {
    const tree = await this.load();
    if (!tree) return [];
    const edges = new Set<string>();
    const result: Array<[string, string]> = [];
    Object.values(tree.nodes).forEach(node => {
      (node.connections ?? []).forEach(target => {
        const key = [node.id, target].sort().join('|');
        if (!edges.has(key)) {
          edges.add(key);
          result.push([node.id, target]);
        }
      });
    });
    return result;
  }

  static async getStartingPoints(): Promise<number> {
    const tree = await this.load();
    return tree?.startingPoints ?? 3;
  }
}

export class MartialArtConfigService {
  private static cache: MartialArtsFile | null = null;

  static async load(): Promise<MartialArtsFile> {
    if (this.cache) return this.cache;
    const cfg = await configService.loadConfig<MartialArtsFile>(ConfigType.MARTIAL_ARTS);
    this.cache = cfg;
    return cfg;
  }

  static async getArt(id: string): Promise<MartialArt | null> {
    const cfg = await this.load();
    return cfg.arts[id] ?? null;
  }

  static clear(): void {
    this.cache = null;
  }
}


