import type { GameStorageService, StorageMode } from './types';
import { LocalStorageService } from './LocalStorageService';

export class SaveServiceFactory {
  static create(mode: StorageMode = 'local'): GameStorageService {
    switch (mode) {
      case 'local':
      default:
        return new LocalStorageService();
    }
  }
}


