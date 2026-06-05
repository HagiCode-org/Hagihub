import path from 'node:path';
import type { BootstrapReport, BootstrapStoreResult } from '../../shared/storage.js';
import { readStore } from './json-store.js';
import { ensureBaseDirectories, resolveDataRoot, resolveStorePath } from './runtime-data-paths.js';
import * as registry from './storage-registry.js';

export async function initialize(): Promise<BootstrapReport> {
  await ensureBaseDirectories();
  const stores = registry.list();
  const results: BootstrapStoreResult[] = [];

  for (const definition of stores) {
    const filePath = resolveStorePath(definition.fileName);
    try {
      const result = await readStore(filePath, definition);
      results.push({
        key: definition.key,
        status: result.source === 'default'
          ? 'initialized'
          : result.source === 'migrated'
            ? 'migrated'
            : 'unchanged',
      });
    } catch (error) {
      results.push({
        key: definition.key,
        status: 'corrupt-recovered',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const report: BootstrapReport = {
    results,
    success: results.every((r) => r.status !== 'corrupt-recovered' || !r.error),
  };

  if (!report.success) {
    console.error('[storage-bootstrap] Some stores failed to initialize:', report.results.filter((r) => r.error));
  } else {
    console.info(`[storage-bootstrap] Initialized ${results.length} store(s) from ${resolveDataRoot()}`);
  }

  return report;
}
