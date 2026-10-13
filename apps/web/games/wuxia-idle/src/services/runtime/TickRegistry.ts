export type TickHandler = (seconds: number) => void | Promise<void>;

class TickRegistry {
  private handlers = new Map<string, TickHandler>();

  register(key: string, handler: TickHandler) {
    this.handlers.set(key, handler);
  }

  unregister(key: string) {
    this.handlers.delete(key);
  }

  entries(): Iterable<[string, TickHandler]> {
    return this.handlers.entries();
  }

  clear() {
    this.handlers.clear();
  }
}

export const tickRegistry = new TickRegistry();
