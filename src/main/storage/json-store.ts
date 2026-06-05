import fs from 'node:fs/promises';
import path from 'node:path';
import type { JsonEnvelope, ReadResult, StoreDefinition } from '../../shared/storage.js';

function createEnvelope<T>(definition: StoreDefinition<T>, data: T): JsonEnvelope<T> {
  return {
    version: definition.version,
    updatedAt: new Date().toISOString(),
    data,
  };
}

function parseEnvelope<T>(raw: string, definition: StoreDefinition<T>): JsonEnvelope<T> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }

    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.version !== 'number' || !('data' in candidate)) {
      return null;
    }

    return parsed as JsonEnvelope<T>;
  } catch {
    return null;
  }
}

export async function readStore<T>(
  filePath: string,
  definition: StoreDefinition<T>,
): Promise<ReadResult<T>> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const envelope = parseEnvelope(raw, definition);

    if (!envelope) {
      return recoverCorrupted(filePath, definition, 'invalid-envelope');
    }

    if (definition.validate && !definition.validate(envelope.data)) {
      if (definition.migrate && envelope.version < definition.version) {
        return migrateAndRewrite(filePath, definition, envelope);
      }
      return recoverCorrupted(filePath, definition, 'validation-failed');
    }

    if (envelope.version < definition.version) {
      if (definition.migrate) {
        return migrateAndRewrite(filePath, definition, envelope);
      }
      return recoverCorrupted(filePath, definition, 'outdated-no-migration');
    }

    return { data: envelope.data, source: 'file', version: envelope.version };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return writeDefault(filePath, definition);
    }
    return recoverCorrupted(filePath, definition, 'read-error');
  }
}

export async function writeStore<T>(
  filePath: string,
  definition: StoreDefinition<T>,
  data: T,
): Promise<void> {
  const envelope = createEnvelope(definition, data);
  await writeAtomically(filePath, JSON.stringify(envelope, null, 2) + '\n');
}

export async function writeAtomically(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const tmpPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  try {
    await fs.writeFile(tmpPath, content, 'utf8');
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => {});
    throw error;
  }
}

async function writeDefault<T>(
  filePath: string,
  definition: StoreDefinition<T>,
): Promise<ReadResult<T>> {
  const envelope = createEnvelope(definition, definition.defaultData);
  await writeAtomically(filePath, JSON.stringify(envelope, null, 2) + '\n');
  return { data: definition.defaultData, source: 'default', version: definition.version };
}

async function migrateAndRewrite<T>(
  filePath: string,
  definition: StoreDefinition<T>,
  envelope: JsonEnvelope,
): Promise<ReadResult<T>> {
  const migratedData = definition.migrate!(envelope.version, envelope.data);
  if (definition.validate && !definition.validate(migratedData)) {
    return recoverCorrupted(filePath, definition, 'migration-validation-failed');
  }

  const newEnvelope = createEnvelope(definition, migratedData);
  await writeAtomically(filePath, JSON.stringify(newEnvelope, null, 2) + '\n');
  return { data: migratedData, source: 'migrated', version: definition.version };
}

async function recoverCorrupted<T>(
  filePath: string,
  definition: StoreDefinition<T>,
  reason: string,
): Promise<ReadResult<T>> {
  const backupPath = `${filePath}.corrupt-${new Date().toISOString().replace(/[:.]/g, '')}.bak`;
  try {
    await fs.rename(filePath, backupPath);
  } catch {
    await fs.unlink(filePath).catch(() => {});
  }

  console.warn(`[json-store] Recovered corrupted store "${definition.key}": ${reason}, backed up to ${backupPath}`);
  return writeDefault(filePath, definition);
}
