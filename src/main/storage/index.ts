/**
 * Hagihub managed storage layer.
 *
 * Data root resolution precedence:
 *   1. HAGIHUB_DATA_DIR environment variable (for tests and managed deployments)
 *   2. Electron desktop: <userData>/hagihub
 *   3. Non-desktop: platform application-data directory (XDG/AppData)
 *   4. Last-resort workspace-local fallback
 *
 * All managed JSON files use a versioned envelope { version, updatedAt, data }.
 * Corrupted files are backed up as .corrupt-<timestamp>.bak and replaced with defaults.
 * Atomic writes use same-directory temp files + rename.
 */
export { readStore, writeStore, writeAtomically } from './json-store.js';
export { resolveDataRoot, resolveStorePath, ensureBaseDirectories } from './runtime-data-paths.js';
export * as storageRegistry from './storage-registry.js';
export { initialize as bootstrapStorage } from './storage-bootstrap.js';

import type { ReadResult, StoreDefinition } from '../../shared/storage.js';
import { readStore, writeStore } from './json-store.js';
import { resolveStorePath } from './runtime-data-paths.js';
import * as registry from './storage-registry.js';

export function createStoreHandle<T>(definition: StoreDefinition<T>) {
  registry.register(definition);
  const filePath = resolveStorePath(definition.fileName);

  return {
    read: () => readStore(filePath, definition),
    write: (data: T) => writeStore(filePath, definition, data),
    definition,
    filePath,
  };
}

export type { ReadResult, StoreDefinition } from '../../shared/storage.js';
