import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { resolveDataRoot, resolveStorePath, ensureBaseDirectories } from '../runtime-data-paths.js';
import { readStore, writeStore, writeAtomically } from '../json-store.js';
import * as registry from '../storage-registry.js';
import type { StoreDefinition } from '../../../shared/storage.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hagihub-test-'));
  process.env.HAGIHUB_DATA_DIR = tmpDir;
  resolveDataRoot({ reset: true });
  registry.clear();
});

after(async () => {
  delete process.env.HAGIHUB_DATA_DIR;
  resolveDataRoot({ reset: true });
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

describe('resolveDataRoot', () => {
  it('uses HAGIHUB_DATA_DIR override', () => {
    const root = resolveDataRoot();
    assert.equal(root, tmpDir);
  });

  it('returns the same path on repeated calls', () => {
    const a = resolveDataRoot();
    const b = resolveDataRoot();
    assert.equal(a, b);
  });

  it('resets when reset option is passed', () => {
    const a = resolveDataRoot();
    const b = resolveDataRoot({ reset: true });
    assert.equal(a, b);
  });
});

describe('resolveStorePath', () => {
  it('resolves a simple file name under the data root', () => {
    const filePath = resolveStorePath('test.json');
    assert.equal(filePath, path.join(tmpDir, 'test.json'));
  });

  it('resolves nested file names', () => {
    const filePath = resolveStorePath('sub/dir/test.json');
    assert.equal(filePath, path.join(tmpDir, 'sub', 'dir', 'test.json'));
  });

  it('rejects absolute paths', () => {
    assert.throws(() => resolveStorePath('/etc/passwd'), /must be relative/);
  });

  it('rejects path traversal attempts', () => {
    assert.throws(() => resolveStorePath('../escape.json'), /escapes managed root/);
    assert.throws(() => resolveStorePath('sub/../../escape.json'), /escapes managed root/);
  });
});

describe('ensureBaseDirectories', () => {
  it('creates the data root directory', async () => {
    const root = await ensureBaseDirectories();
    const stat = await fs.stat(root);
    assert.ok(stat.isDirectory());
  });

  it('is idempotent', async () => {
    await ensureBaseDirectories();
    await ensureBaseDirectories();
    const stat = await fs.stat(tmpDir);
    assert.ok(stat.isDirectory());
  });
});

describe('storage registry', () => {
  const testDef: StoreDefinition<{ value: string }> = {
    key: 'test',
    fileName: 'test.json',
    version: 1,
    defaultData: { value: 'default' },
  };

  it('registers and retrieves a store', () => {
    registry.register(testDef);
    assert.deepEqual(registry.get('test'), testDef);
  });

  it('rejects duplicate keys', () => {
    registry.register(testDef);
    assert.throws(() => registry.register(testDef), /Duplicate store key/);
  });

  it('lists all registered stores', () => {
    registry.register(testDef);
    registry.register({ ...testDef, key: 'test2', fileName: 'test2.json' });
    assert.equal(registry.list().length, 2);
  });

  it('checks existence with has()', () => {
    assert.equal(registry.has('nonexistent'), false);
    registry.register(testDef);
    assert.equal(registry.has('test'), true);
  });
});

describe('readStore', () => {
  const def: StoreDefinition<{ value: string }> = {
    key: 'test-read',
    fileName: 'test-read.json',
    version: 1,
    defaultData: { value: 'default' },
  };

  it('creates default when file does not exist', async () => {
    const filePath = path.join(tmpDir, 'test-read.json');
    const result = await readStore(filePath, def);
    assert.equal(result.source, 'default');
    assert.deepEqual(result.data, { value: 'default' });
    assert.equal(result.version, 1);

    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(raw.version, 1);
    assert.deepEqual(raw.data, { value: 'default' });
  });

  it('reads existing valid envelope', async () => {
    const filePath = path.join(tmpDir, 'test-read.json');
    const envelope = { version: 1, updatedAt: new Date().toISOString(), data: { value: 'stored' } };
    await fs.writeFile(filePath, JSON.stringify(envelope));

    const result = await readStore(filePath, def);
    assert.equal(result.source, 'file');
    assert.deepEqual(result.data, { value: 'stored' });
  });

  it('recovers from invalid JSON', async () => {
    const filePath = path.join(tmpDir, 'test-read.json');
    await fs.writeFile(filePath, 'not json {{{');

    const result = await readStore(filePath, def);
    assert.equal(result.source, 'default');
    assert.deepEqual(result.data, { value: 'default' });

    const files = await fs.readdir(tmpDir);
    const backup = files.find((f) => f.includes('.corrupt-'));
    assert.ok(backup, 'should create a backup of the corrupted file');
  });

  it('recovers when validation fails', async () => {
    const filePath = path.join(tmpDir, 'test-read.json');
    const envelope = { version: 1, updatedAt: new Date().toISOString(), data: { wrong: true } };
    await fs.writeFile(filePath, JSON.stringify(envelope));

    const defWithValidation: StoreDefinition<{ value: string }> = {
      ...def,
      validate: (data): data is { value: string } => {
        return typeof data === 'object' && data !== null && 'value' in data;
      },
    };

    const result = await readStore(filePath, defWithValidation);
    assert.equal(result.source, 'default');
  });
});

describe('writeStore', () => {
  const def: StoreDefinition<{ value: string }> = {
    key: 'test-write',
    fileName: 'test-write.json',
    version: 1,
    defaultData: { value: 'default' },
  };

  it('writes a valid envelope', async () => {
    const filePath = path.join(tmpDir, 'test-write.json');
    await writeStore(filePath, def, { value: 'written' });

    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(raw.version, 1);
    assert.deepEqual(raw.data, { value: 'written' });
    assert.ok(raw.updatedAt);
  });

  it('overwrites existing data atomically', async () => {
    const filePath = path.join(tmpDir, 'test-write.json');
    await writeStore(filePath, def, { value: 'first' });
    await writeStore(filePath, def, { value: 'second' });

    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.deepEqual(raw.data, { value: 'second' });
  });
});

describe('writeAtomically', () => {
  it('creates parent directories', async () => {
    const filePath = path.join(tmpDir, 'deep', 'nested', 'file.json');
    await writeAtomically(filePath, '{"ok":true}');

    const raw = await fs.readFile(filePath, 'utf8');
    assert.equal(raw, '{"ok":true}');
  });

  it('cleans up temp file on failure', async () => {
    const filePath = path.join(tmpDir, 'atomic-fail.json');
    await assert.rejects(
      () => writeAtomically('/nonexistent/path/file.json', 'data'),
    );

    const files = await fs.readdir(tmpDir);
    const tmpFiles = files.filter((f) => f.includes('.tmp.'));
    assert.equal(tmpFiles.length, 0, 'should not leave temp files');
  });
});

describe('migration', () => {
  it('migrates from older version', async () => {
    const filePath = path.join(tmpDir, 'migrate.json');
    const oldEnvelope = { version: 1, updatedAt: new Date().toISOString(), data: { value: 'old' } };
    await fs.writeFile(filePath, JSON.stringify(oldEnvelope));

    const def: StoreDefinition<{ value: string; extra: boolean }> = {
      key: 'migrate',
      fileName: 'migrate.json',
      version: 2,
      defaultData: { value: 'default', extra: false },
      migrate: (fromVersion, data) => {
        const old = data as { value: string };
        return { value: old.value, extra: true };
      },
    };

    const result = await readStore(filePath, def);
    assert.equal(result.source, 'migrated');
    assert.equal(result.version, 2);
    assert.deepEqual(result.data, { value: 'old', extra: true });

    const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
    assert.equal(raw.version, 2);
  });

  it('falls back to default when migration fails validation', async () => {
    const filePath = path.join(tmpDir, 'migrate-fail.json');
    const oldEnvelope = { version: 1, updatedAt: new Date().toISOString(), data: { value: 'old' } };
    await fs.writeFile(filePath, JSON.stringify(oldEnvelope));

    const def: StoreDefinition<{ value: string }> = {
      key: 'migrate-fail',
      fileName: 'migrate-fail.json',
      version: 2,
      defaultData: { value: 'default' },
      validate: (data): data is { value: string } => {
        return typeof data === 'object' && data !== null && 'value' in data;
      },
      migrate: (_fromVersion, _data) => {
        return { wrong: true } as unknown as { value: string };
      },
    };

    const result = await readStore(filePath, def);
    assert.equal(result.source, 'default');
  });
});
