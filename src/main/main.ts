import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchActionsSummaries, fetchOrgs, fetchRepos } from './github-api.js';
import { GitHubAuthManager, githubDeviceFlowEventChannel } from './github-auth.js';
import type {
  AppInfo,
  ExternalOpenResult,
  GitHubActionsResult,
  OrgsResult,
  PlatformId,
  ReposResult,
} from '../shared/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_RENDERER_HOST = '127.0.0.1';
const DEV_RENDERER_PORT = 36599;
const DEV_RENDERER_URL = `http://${DEV_RENDERER_HOST}:${DEV_RENDERER_PORT}`;

let mainWindow: BrowserWindow | null = null;
let gitHubAuthManager: GitHubAuthManager | null = null;

function resolvePlatformId(platform: NodeJS.Platform, arch: string): PlatformId {
  if (platform === 'darwin') {
    return arch === 'arm64' ? 'osx-arm64' : 'osx-x64';
  }

  if (platform === 'win32') {
    return arch === 'arm64' ? 'win-arm64' : 'win-x64';
  }

  return arch === 'arm64' ? 'linux-arm64' : 'linux-x64';
}

function getDistRootPath(): string {
  return path.resolve(__dirname, '..');
}

function getRendererEntryPath(): string {
  return path.join(getDistRootPath(), 'renderer', 'index.html');
}

function getPreloadPath(): string {
  return path.join(getDistRootPath(), 'preload', 'index.mjs');
}

function getWindowIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icon.png');
  }

  return path.resolve(process.cwd(), 'resources', 'icon.png');
}

function isDevServerEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

function createAppInfo(): AppInfo {
  return {
    appName: app.getName(),
    appVersion: app.getVersion(),
    platform: resolvePlatformId(process.platform, process.arch),
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    isPackaged: app.isPackaged,
    buildChannel: isDevServerEnabled() ? 'development' : 'production',
  };
}

function emitDeviceFlowUpdate(payload: unknown): void {
  mainWindow?.webContents.send(githubDeviceFlowEventChannel, payload);
}

function registerIpcHandlers(): void {
  gitHubAuthManager = new GitHubAuthManager(emitDeviceFlowUpdate);
  ipcMain.handle('hagihub:get-app-info', () => createAppInfo());
  ipcMain.handle('hagihub:open-external', async (_event, url: string): Promise<ExternalOpenResult> => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
  ipcMain.handle('hagihub:start-device-flow', async () => {
    if (!gitHubAuthManager) {
      throw new Error('GitHub auth manager is unavailable.');
    }

    return await gitHubAuthManager.startDeviceFlow();
  });
  ipcMain.handle('hagihub:cancel-device-flow', async () => {
    if (!gitHubAuthManager) {
      throw new Error('GitHub auth manager is unavailable.');
    }

    return await gitHubAuthManager.cancelDeviceFlow();
  });
  ipcMain.handle('hagihub:remove-github-account', async (_event, accountId: string) => {
    if (!gitHubAuthManager) {
      throw new Error('GitHub auth manager is unavailable.');
    }

    return await gitHubAuthManager.removeAccount(accountId);
  });
  ipcMain.handle('hagihub:get-github-accounts', async () => {
    if (!gitHubAuthManager) {
      throw new Error('GitHub auth manager is unavailable.');
    }

    return await gitHubAuthManager.getAccounts();
  });
  ipcMain.handle('hagihub:switch-github-account', async (_event, accountId: string) => {
    if (!gitHubAuthManager) {
      throw new Error('GitHub auth manager is unavailable.');
    }

    return await gitHubAuthManager.switchAccount(accountId);
  });
  ipcMain.handle('hagihub:fetch-github-repos', async (_event, accountId: string): Promise<ReposResult> => {
    if (!gitHubAuthManager) {
      throw new Error('GitHub auth manager is unavailable.');
    }

    const token = await gitHubAuthManager.getDecryptedToken(accountId);
    return {
      repos: await fetchRepos(token),
    };
  });
  ipcMain.handle('hagihub:fetch-github-orgs', async (_event, accountId: string): Promise<OrgsResult> => {
    if (!gitHubAuthManager) {
      throw new Error('GitHub auth manager is unavailable.');
    }

    const token = await gitHubAuthManager.getDecryptedToken(accountId);
    return {
      orgs: await fetchOrgs(token),
    };
  });
  ipcMain.handle(
    'hagihub:fetch-github-actions',
    async (_event, accountId: string, repoFullNames: string[]): Promise<GitHubActionsResult> => {
      if (!gitHubAuthManager) {
        throw new Error('GitHub auth manager is unavailable.');
      }

      const token = await gitHubAuthManager.getDecryptedToken(accountId);
      return await fetchActionsSummaries(token, repoFullNames);
    },
  );
}

async function createMainWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#09111f',
    autoHideMenuBar: true,
    title: 'Hagihub',
    icon: getWindowIconPath(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDevServerEnabled()) {
    await mainWindow.loadURL(DEV_RENDERER_URL);
    return;
  }

  await mainWindow.loadFile(getRendererEntryPath());
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return;
    }

    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    registerIpcHandlers();
    await createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow();
      }
    });
  }).catch((error) => {
    console.error('[main] failed to initialize hagihub', error);
    app.exit(1);
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
