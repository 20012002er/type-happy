export interface Gauge { current: number; max: number }

export interface StaminaBaseConfig {
  staminaMax: number;
  satietyMax: number;
  staminaRegenPerMin: number;
  satietyDecayPerHour: number;
}

export interface StaminaCostsConfig {
  combat: number;
  explore: number;
  lifeJob: number;
}

export interface StaminaRegenModifier {
  when: string; // 简化表达式，如 'satiety<30' 或 'meditating'
  staminaRegenMultiplier: number;
}

export interface StaminaConfigFile {
  version: string;
  lastUpdated: string;
  base: StaminaBaseConfig;
  costs: StaminaCostsConfig;
  regenModifiers?: StaminaRegenModifier[];
}
