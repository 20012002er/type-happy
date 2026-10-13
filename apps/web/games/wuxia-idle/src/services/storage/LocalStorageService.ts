import type { GameStorageService } from './types';

const SAVE_KEY = 'wuxia-idle-save-v1';

export class LocalStorageService implements GameStorageService {
  async save(encryptedPayload: string): Promise<void> {
    const wrapped = {
      payload: encryptedPayload,
      savedAt: Date.now(),
      version: '1.0.0'
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(wrapped));
  }

  async load(): Promise<string | null> {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return typeof data.payload === 'string' ? data.payload : null;
    } catch {
      console.warn('[Save][Local] load() failed to parse');
      return null;
    }
  }

  async getLastSaveTime(): Promise<number> {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return 0;
      const data = JSON.parse(raw);
      return typeof data.savedAt === 'number' ? data.savedAt : 0;
    } catch {
      console.warn('[Save][Local] getLastSaveTime() parse error');
      return 0;
    }
  }
}


