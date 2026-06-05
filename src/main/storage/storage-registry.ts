import type { StoreDefinition } from '../../shared/storage.js';

const stores = new Map<string, StoreDefinition>();

export function register<T>(definition: StoreDefinition<T>): void {
  if (stores.has(definition.key)) {
    throw new Error(`Duplicate store key: "${definition.key}"`);
  }
  stores.set(definition.key, definition as StoreDefinition);
}

export function get(key: string): StoreDefinition | undefined {
  return stores.get(key);
}

export function list(): StoreDefinition[] {
  return Array.from(stores.values());
}

export function has(key: string): boolean {
  return stores.has(key);
}

export function clear(): void {
  stores.clear();
}
