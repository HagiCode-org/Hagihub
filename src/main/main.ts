import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  commitFile,
  createGitHubRepo,
  createPullRequest,
  createRef,
  dispatchGitHubWorkflow,
  parseActionRecommendations,
  fetchActionsSummaries,
  fetchFileContent,
  fetchOrgs,
  fetchReadmeWorkspace,
  fetchRepoDetails,
  fetchRepos,
  listGitHubRepoWorkflows,
  refreshManagedActionRuns,
  searchGitHubWorkflows,
  submitReadmeWorkspace,
  updateRepo,
  updateRepoTopics,
} from './github-api.js';
import { createGithubApiCache } from './github-api-cache.js';
import { GitHubAuthManager, githubDeviceFlowEventChannel } from './github-auth.js';
import { bootstrapStorage } from './storage/index.js';
import { managedActionsStore } from './storage/stores.js';
import type {
  AppInfo,
  CommitFilePayload,
  CommitFileResult,
  CreateGitHubRepoPayload,
  CreateGitHubRepoResult,
  CreatePullRequestPayload,
  CreateRefPayload,
  ExternalOpenResult,
  FetchActionRecommendationsResult,
  FileContentResult,
  GitHubActionsResult,
  GitHubManagedWorkflowReference,
  GitHubWorkflowDispatchRequest,
  GitHubWorkflowDispatchResponse,
  ListGitHubRepoWorkflowsResult,
  ManagedActionsResult,
  OrgsResult,
  PlatformId,
  PullRequestResult,
  ReadmeBatchSubmissionResult,
  RefreshManagedActionsResult,
  ReadmeWorkspaceResult,
  RepoDetailsResult,
  ReposResult,
  SendNotificationParams,
  SendNotificationResult,
  SearchGitHubWorkflowsResult,
  SubmitReadmeWorkspacePayload,
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
let notificationSequence = 0;
const githubCache = createGithubApiCache();

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

function emitRendererEvent(channel: string, ...args: unknown[]): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(channel, ...args);
}

function focusMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function createNotificationId(): string {
  notificationSequence += 1;
  return `notification-${Date.now()}-${notificationSequence}`;
}

async function handleNotificationClick(
  notificationId: string,
  clickAction: SendNotificationParams['clickAction'],
): Promise<void> {
  const action = clickAction ?? { type: 'focus-window' as const };

  try {
    if (action.type === 'open-url') {
      await shell.openExternal(action.url);
      return;
    }

    focusMainWindow();

    if (action.section) {
      emitRendererEvent('hagihub:navigate-to-section', action.section);
    }
  } finally {
    emitRendererEvent('hagihub:notification-clicked', notificationId);
  }
}

async function sendNotificationHandler(params: SendNotificationParams): Promise<SendNotificationResult> {
  if (!Notification.isSupported()) {
    return {
      success: false,
      error: 'Desktop notifications are not supported in the current environment.',
    };
  }

  try {
    const notificationId = createNotificationId();
    const notification = new Notification({
      title: params.title,
      body: params.body,
      icon: params.icon,
      silent: params.silent,
    });
    let shownEventSent = false;

    const emitShown = () => {
      if (shownEventSent) {
        return;
      }

      shownEventSent = true;
      emitRendererEvent('hagihub:notification-shown', notificationId);
    };

    notification.on('show', emitShown);
    notification.on('click', () => {
      void handleNotificationClick(notificationId, params.clickAction);
    });

    notification.show();
    setTimeout(emitShown, 0);

    if (typeof params.duration === 'number' && params.duration > 0) {
      setTimeout(() => {
        notification.close();
      }, params.duration);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function requireGitHubAuthManager(): GitHubAuthManager {
  if (!gitHubAuthManager) {
    throw new Error('GitHub auth manager is unavailable.');
  }

  return gitHubAuthManager;
}

async function getOrLoadGithubCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = githubCache.get<T>(key);

  if (cached) {
    return cached;
  }

  const result = await load();
  githubCache.set(key, result);
  return result;
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
      monitored: workflow.monitored ?? false,
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
  ipcMain.handle('hagihub:send-notification', async (_event, params: SendNotificationParams): Promise<SendNotificationResult> => {
    return await sendNotificationHandler(params);
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
    githubCache.invalidateAll();
    return await requireGitHubAuthManager().switchAccount(accountId);
  });
  ipcMain.handle('hagihub:fetch-github-repos', async (_event, accountId: string): Promise<ReposResult> => {
    return await getOrLoadGithubCache('github-repos:' + accountId, async () => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return {
        repos: await fetchRepos(token),
      };
    });
  });
  ipcMain.handle('hagihub:fetch-github-orgs', async (_event, accountId: string): Promise<OrgsResult> => {
    return await getOrLoadGithubCache('github-orgs:' + accountId, async () => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return {
        orgs: await fetchOrgs(token),
      };
    });
  });
  ipcMain.handle(
    'hagihub:create-github-repo',
    async (_event, accountId: string, payload: CreateGitHubRepoPayload): Promise<CreateGitHubRepoResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await createGitHubRepo(token, payload);
    },
  );
  ipcMain.handle('hagihub:invalidate-github-cache', async (): Promise<void> => {
    githubCache.invalidateAll();
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
    'hagihub:fetch-action-recommendations',
    async (_event, accountId: string, owner: string, repo: string): Promise<FetchActionRecommendationsResult> => {
      const repoFullName = `${owner}/${repo}`;

      return await getOrLoadGithubCache(`github-action-recommendations:${accountId}:${repoFullName}`, async () => {
        const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
        const yamlFile = await fetchFileContent(token, owner, repo, '.hagihub/settings.yaml');

        if (yamlFile.exists) {
          return {
            repoFullName,
            recommendations: parseActionRecommendations(yamlFile.content),
          };
        }

        const ymlFile = await fetchFileContent(token, owner, repo, '.hagihub/settings.yml');
        return {
          repoFullName,
          recommendations: ymlFile.exists ? parseActionRecommendations(ymlFile.content) : [],
        };
      });
    },
  );
  ipcMain.handle(
    'hagihub:fetch-file-content',
    async (_event, accountId: string, owner: string, repo: string, path: string): Promise<FileContentResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await fetchFileContent(token, owner, repo, path);
    },
  );
  ipcMain.handle(
    'hagihub:fetch-readme-workspace',
    async (_event, accountId: string, owner: string, repo: string): Promise<ReadmeWorkspaceResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await fetchReadmeWorkspace(token, owner, repo);
    },
  );
  ipcMain.handle(
    'hagihub:submit-readme-workspace',
    async (_event, accountId: string, owner: string, repo: string, payload: SubmitReadmeWorkspacePayload): Promise<ReadmeBatchSubmissionResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await submitReadmeWorkspace(token, owner, repo, payload);
    },
  );
  ipcMain.handle(
    'hagihub:commit-file',
    async (_event, accountId: string, owner: string, repo: string, path: string, payload: CommitFilePayload): Promise<CommitFileResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await commitFile(token, owner, repo, path, payload);
    },
  );
  ipcMain.handle(
    'hagihub:create-ref',
    async (_event, accountId: string, owner: string, repo: string, payload: CreateRefPayload): Promise<void> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      await createRef(token, owner, repo, payload.ref, payload.sha);
    },
  );
  ipcMain.handle(
    'hagihub:create-pull-request',
    async (_event, accountId: string, owner: string, repo: string, payload: CreatePullRequestPayload): Promise<PullRequestResult> => {
      const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
      return await createPullRequest(token, owner, repo, payload.title, payload.head, payload.base);
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
    'hagihub:list-github-repo-workflows',
    async (_event, accountId: string, repoFullName: string): Promise<ListGitHubRepoWorkflowsResult> => {
      return await getOrLoadGithubCache('github-workflows:' + accountId + ':' + repoFullName, async () => {
        const token = await requireGitHubAuthManager().getDecryptedToken(accountId);
        return await listGitHubRepoWorkflows(token, accountId, repoFullName);
      });
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
