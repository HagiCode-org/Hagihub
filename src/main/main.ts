import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  dispatchGitHubWorkflow,
  fetchActionsSummaries,
  fetchOrgs,
  fetchRepoDetails,
  fetchRepos,
  refreshManagedActionRuns,
  searchGitHubWorkflows,
  updateRepo,
  updateRepoTopics,
} from './github-api.js';
import { GitHubAuthManager, githubDeviceFlowEventChannel } from './github-auth.js';
import { bootstrapStorage } from './storage/index.js';
import { managedActionsStore } from './storage/stores.js';
import type {
  AppInfo,
  ExternalOpenResult,
  GitHubActionsResult,
  GitHubManagedWorkflowReference,
  GitHubWorkflowDispatchRequest,
  GitHubWorkflowDispatchResponse,
  ManagedActionsResult,
  OrgsResult,
  PlatformId,
  RefreshManagedActionsResult,
  RepoDetailsResult,
  ReposResult,
  SearchGitHubWorkflowsResult,
  UpdateRepoPayload,
  UpdateRepoResult,
  UpdateRepoTopicsResult,
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

function requireGitHubAuthManager(): GitHubAuthManager {
  if (!gitHubAuthManager) {
    throw new Error('GitHub auth manager is unavailable.');
  }

  return gitHubAuthManager;
}

async function readManagedActions(accountId: string): Promise<GitHubManagedWorkflowReference[]> {
  const { data } = await managedActionsStore.read();
  return data.accounts.find((entry) => entry.accountId === accountId)?.workflows ?? [];
}

function normalizeManagedWorkflows(
  accountId: string,
  workflows: GitHubManagedWorkflowReference[],
): GitHubManagedWorkflowReference[] {
  const deduped = new Map<string, GitHubManagedWorkflowReference>();

  for (const workflow of workflows) {
    const normalized: GitHubManagedWorkflowReference = {
      ...workflow,
      accountId,
    };

    deduped.set(`${normalized.repoFullName}#${normalized.workflowId}`, normalized);
  }

  return Array.from(deduped.values()).sort((left, right) => {
    const repoComparison = left.repoFullName.localeCompare(right.repoFullName);
    return repoComparison !== 0 ? repoComparison : left.workflowName.localeCompare(right.workflowName);
  });
}

async function writeManagedActions(
  accountId: string,
  workflows: GitHubManagedWorkflowReference[],
): Promise<GitHubManagedWorkflowReference[]> {
  const { data } = await managedActionsStore.read();
  const normalized = normalizeManagedWorkflows(accountId, workflows);
  const accounts = data.accounts.filter((entry) => entry.accountId !== accountId);
  accounts.push({
    accountId,
    workflows: normalized,
  });

  await managedActionsStore.write({
    accounts,
  });

  return normalized;
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
    return await requireGitHubAuthManager().startDeviceFlow();
  });
  ipcMain.handle('hagihub:cancel-device-flow', async () => {
    return await requireGitHubAuthManager().cancelDeviceFlow();
  });
  ipcMain.handle('hagihub:remove-github-account', async (_event, accountId: string) => {
    return await requireGitHubAuthManager().removeAccount(accountId);
  });
  ipcMain.handle('hagihub:get-github-accounts', async () => {
    return await requireGitHubAuthManager().getAccounts();
  });
  ipcMain.handle('hagihub:switch-github-account', async (_event, accountId: string) => {
    return await requireGitHubAuthManager().switchAccount(accountId);
  });
  ipcMain.handle('hagihub:fetch-github-repos', async (_event, accountId: string): Promise<ReposResult> => {
    const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
    return {
      repos: await fetchRepos(token),
    };
  });
  ipcMain.handle('hagihub:fetch-github-orgs', async (_event, accountId: string): Promise<OrgsResult> => {
    const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
    return {
      orgs: await fetchOrgs(token),
    };
  });
  ipcMain.handle(
    'hagihub:fetch-github-actions',
    async (_event, accountId: string, repoFullNames: string[]): Promise<GitHubActionsResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await fetchActionsSummaries(token, repoFullNames);
    },
  );
  ipcMain.handle(
    'hagihub:fetch-repo-details',
    async (_event, accountId: string, owner: string, repo: string): Promise<RepoDetailsResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return { details: await fetchRepoDetails(token, owner, repo) };
    },
  );
  ipcMain.handle(
    'hagihub:update-repo',
    async (_event, accountId: string, owner: string, repo: string, updates: UpdateRepoPayload): Promise<UpdateRepoResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return { details: await updateRepo(token, owner, repo, updates) };
    },
  );
  ipcMain.handle(
    'hagihub:update-repo-topics',
    async (_event, accountId: string, owner: string, repo: string, names: string[]): Promise<UpdateRepoTopicsResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await updateRepoTopics(token, owner, repo, names);
    },
  );
  ipcMain.handle(
    'hagihub:search-github-workflows',
    async (_event, accountId: string, query: string): Promise<SearchGitHubWorkflowsResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await searchGitHubWorkflows(token, accountId, query);
    },
  );
  ipcMain.handle('hagihub:get-managed-actions', async (_event, accountId: string): Promise<ManagedActionsResult> => {
    return {
      workflows: await readManagedActions(accountId),
    };
  });
  ipcMain.handle(
    'hagihub:save-managed-actions',
    async (_event, accountId: string, workflows: GitHubManagedWorkflowReference[]): Promise<ManagedActionsResult> => {
      return {
        workflows: await writeManagedActions(accountId, workflows),
      };
    },
  );
  ipcMain.handle(
    'hagihub:refresh-managed-action-runs',
    async (_event, accountId: string, workflows: GitHubManagedWorkflowReference[]): Promise<RefreshManagedActionsResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      const targetWorkflows = workflows.length > 0 ? normalizeManagedWorkflows(accountId, workflows) : await readManagedActions(accountId);
      return await refreshManagedActionRuns(token, targetWorkflows);
    },
  );
  ipcMain.handle(
    'hagihub:dispatch-github-workflow',
    async (_event, accountId: string, request: GitHubWorkflowDispatchRequest): Promise<GitHubWorkflowDispatchResponse> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await dispatchGitHubWorkflow(token, request);
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
    await bootstrapStorage();
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
