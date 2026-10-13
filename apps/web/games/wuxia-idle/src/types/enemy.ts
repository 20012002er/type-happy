export interface EnemyStats {
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  level: number;
}

export interface EnemyAI {
  skillUseChance?: number;
  skills?: string[];
}

export interface Enemy {
  id: string;
  name: string;
  description?: string;
  image?: string; // 形象图片（可选，OSS公开链接）
  stats: EnemyStats;
  dropGroup?: string; // 与地图掉落组对齐
  // 可选的数值配置：用于动态生成遭遇时的二次计算
  attackBase?: number;            // 攻击力基数（覆盖 stats.attack 作为基）
  levelAttackGrowth?: number;     // 每级攻击成长系数（如 0.05 表示每级+5%）
  // 可选：武学掉落（小概率）
  martialArtDrop?: {
    pool: string[];  // 武学ID候选
    chance: number;  // 0~1 概率
  };
  ai?: EnemyAI;
}


