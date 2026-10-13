export interface PriceItem { id: string; qty: number; }
export interface Price { gold?: number; items?: PriceItem[] }
export interface Reward { gold?: number; items?: PriceItem[] }
