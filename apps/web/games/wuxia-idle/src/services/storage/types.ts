export interface GameStorageService {
  save(encryptedPayload: string): Promise<void>;
  load(): Promise<string | null>;
  getLastSaveTime(): Promise<number>;
}

export type StorageMode = 'local' | 'remote';

