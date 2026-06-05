import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const ENV_OVERRIDE_KEY = 'HAGIHUB_DATA_DIR';
const DATA_ROOT_DIR_NAME = 'hagihub';

let cachedDataRoot: string | null = null;

function normalizePath(input: string): string {
  return path.resolve(input);
}

function resolveNonDesktopDataRoot(): string {
  const platform = process.platform;

  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', DATA_ROOT_DIR_NAME);
  }

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, DATA_ROOT_DIR_NAME);
  }

  const xdgDataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
  return path.join(xdgDataHome, DATA_ROOT_DIR_NAME);
}

function resolveDesktopDataRoot(): string | null {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), DATA_ROOT_DIR_NAME);
  } catch {
    return null;
  }
}

export function resolveDataRoot(options?: { reset?: boolean }): string {
  if (options?.reset) {
    cachedDataRoot = null;
  }

  if (cachedDataRoot) {
    return cachedDataRoot;
  }

  const envOverride = process.env[ENV_OVERRIDE_KEY]?.trim();
  if (envOverride) {
    cachedDataRoot = normalizePath(envOverride);
    return cachedDataRoot;
  }

  const desktopRoot = resolveDesktopDataRoot();
  if (desktopRoot) {
    cachedDataRoot = normalizePath(desktopRoot);
    return cachedDataRoot;
  }

  cachedDataRoot = normalizePath(resolveNonDesktopDataRoot());
  return cachedDataRoot;
}

export function resolveStorePath(fileName: string): string {
  const root = resolveDataRoot();
  const normalized = path.normalize(fileName);

  if (path.isAbsolute(normalized)) {
    throw new Error(`Store file name must be relative, got absolute path: ${fileName}`);
  }

  const resolved = path.resolve(root, normalized);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Store file name escapes managed root: ${fileName}`);
  }

  return resolved;
}

export async function ensureBaseDirectories(): Promise<string> {
  const root = resolveDataRoot();
  await fs.mkdir(root, { recursive: true });
  return root;
}

export function getOverrideKey(): string {
  return ENV_OVERRIDE_KEY;
}
