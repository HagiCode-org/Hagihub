import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  CommitFilePayload,
  CommitFileResult,
  CreateGitHubRepoPayload,
  CreateGitHubRepoResult,
  CreatePullRequestPayload,
  CreateRefPayload,
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  ExternalOpenResult,
  GitHubActionsResult,
  GitHubAccountsResult,
  GitHubManagedWorkflowReference,
  FileContentResult,
  ListGitHubRepoWorkflowsResult,
  GitHubWorkflowDispatchRequest,
  GitHubWorkflowDispatchResponse,
  OrgsResult,
  ReadmeBatchSubmissionResult,
  ManagedActionsResult,
  PullRequestResult,
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

const deviceFlowEventChannel = 'hagihub:device-flow-update';

ipcRenderer.on(deviceFlowEventChannel, (_event, payload: DeviceFlowPollResult) => {
  window.dispatchEvent(new CustomEvent<DeviceFlowPollResult>(deviceFlowEventChannel, {
    detail: payload,
  }));
});

ipcRenderer.on('hagihub:notification-shown', (_event, notificationId: string) => {
  window.dispatchEvent(new CustomEvent<string>('hagihub:notification-shown', {
    detail: notificationId,
  }));
});

ipcRenderer.on('hagihub:notification-clicked', (_event, notificationId: string) => {
  window.dispatchEvent(new CustomEvent<string>('hagihub:notification-clicked', {
    detail: notificationId,
  }));
});

ipcRenderer.on('hagihub:navigate-to-section', (_event, section: string) => {
  window.dispatchEvent(new CustomEvent<string>('hagihub:navigate-to-section', {
    detail: section,
  }));
});

const hagihubApi = {
  getAppInfo: () => ipcRenderer.invoke('hagihub:get-app-info') as Promise<AppInfo>,
  openExternal: (url: string) => ipcRenderer.invoke('hagihub:open-external', url) as Promise<ExternalOpenResult>,
  startDeviceFlow: () => ipcRenderer.invoke('hagihub:start-device-flow') as Promise<DeviceFlowStartResult>,
  cancelDeviceFlow: () => ipcRenderer.invoke('hagihub:cancel-device-flow') as Promise<DeviceFlowPollResult>,
  removeGitHubAccount: (accountId: string) => ipcRenderer.invoke('hagihub:remove-github-account', accountId) as Promise<GitHubAccountsResult>,
  getGitHubAccounts: () => ipcRenderer.invoke('hagihub:get-github-accounts') as Promise<GitHubAccountsResult>,
  switchGitHubAccount: (accountId: string) => ipcRenderer.invoke('hagihub:switch-github-account', accountId) as Promise<GitHubAccountsResult>,
  invalidateGitHubCache: () => ipcRenderer.invoke('hagihub:invalidate-github-cache') as Promise<void>,
  fetchGitHubRepos: (accountId: string) => ipcRenderer.invoke('hagihub:fetch-github-repos', accountId) as Promise<ReposResult>,
  fetchGitHubOrgs: (accountId: string) => ipcRenderer.invoke('hagihub:fetch-github-orgs', accountId) as Promise<OrgsResult>,
  createGitHubRepo: (accountId: string, payload: CreateGitHubRepoPayload) => ipcRenderer.invoke('hagihub:create-github-repo', accountId, payload) as Promise<CreateGitHubRepoResult>,
  fetchGitHubActions: (accountId: string, repoFullNames: string[]) => ipcRenderer.invoke('hagihub:fetch-github-actions', accountId, repoFullNames) as Promise<GitHubActionsResult>,
  fetchRepoDetails: (accountId: string, owner: string, repo: string) => ipcRenderer.invoke('hagihub:fetch-repo-details', accountId, owner, repo) as Promise<RepoDetailsResult>,
  fetchFileContent: (accountId: string, owner: string, repo: string, path: string) => ipcRenderer.invoke('hagihub:fetch-file-content', accountId, owner, repo, path) as Promise<FileContentResult>,
  fetchReadmeWorkspace: (accountId: string, owner: string, repo: string) => ipcRenderer.invoke('hagihub:fetch-readme-workspace', accountId, owner, repo) as Promise<ReadmeWorkspaceResult>,
  submitReadmeWorkspace: (accountId: string, owner: string, repo: string, payload: SubmitReadmeWorkspacePayload) => ipcRenderer.invoke('hagihub:submit-readme-workspace', accountId, owner, repo, payload) as Promise<ReadmeBatchSubmissionResult>,
  commitFile: (accountId: string, owner: string, repo: string, path: string, payload: CommitFilePayload) => ipcRenderer.invoke('hagihub:commit-file', accountId, owner, repo, path, payload) as Promise<CommitFileResult>,
  createRef: (accountId: string, owner: string, repo: string, payload: CreateRefPayload) => ipcRenderer.invoke('hagihub:create-ref', accountId, owner, repo, payload) as Promise<void>,
  createPullRequest: (accountId: string, owner: string, repo: string, payload: CreatePullRequestPayload) => ipcRenderer.invoke('hagihub:create-pull-request', accountId, owner, repo, payload) as Promise<PullRequestResult>,
  updateRepo: (accountId: string, owner: string, repo: string, updates: UpdateRepoPayload) => ipcRenderer.invoke('hagihub:update-repo', accountId, owner, repo, updates) as Promise<UpdateRepoResult>,
  updateRepoTopics: (accountId: string, owner: string, repo: string, names: string[]) => ipcRenderer.invoke('hagihub:update-repo-topics', accountId, owner, repo, names) as Promise<UpdateRepoTopicsResult>,
  listGitHubRepoWorkflows: (accountId: string, repoFullName: string) => ipcRenderer.invoke('hagihub:list-github-repo-workflows', accountId, repoFullName) as Promise<ListGitHubRepoWorkflowsResult>,
  searchGitHubWorkflows: (accountId: string, query: string) => ipcRenderer.invoke('hagihub:search-github-workflows', accountId, query) as Promise<SearchGitHubWorkflowsResult>,
  getManagedActions: (accountId: string) => ipcRenderer.invoke('hagihub:get-managed-actions', accountId) as Promise<ManagedActionsResult>,
  saveManagedActions: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => ipcRenderer.invoke('hagihub:save-managed-actions', accountId, workflows) as Promise<ManagedActionsResult>,
  refreshManagedActionRuns: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => ipcRenderer.invoke('hagihub:refresh-managed-action-runs', accountId, workflows) as Promise<RefreshManagedActionsResult>,
  dispatchGitHubWorkflow: (accountId: string, request: GitHubWorkflowDispatchRequest) => ipcRenderer.invoke('hagihub:dispatch-github-workflow', accountId, request) as Promise<GitHubWorkflowDispatchResponse>,
  sendNotification: (params: SendNotificationParams) => ipcRenderer.invoke('hagihub:send-notification', params) as Promise<SendNotificationResult>,
  onNavigateToSection: (callback: (section: string) => void) => {
    const listener = (_event: unknown, section: string) => {
      window.dispatchEvent(new CustomEvent<string>('hagihub:navigate-to-section', {
        detail: section,
      }));
      callback(section);
    };

    ipcRenderer.on('hagihub:navigate-to-section', listener);
    return () => {
      ipcRenderer.removeListener('hagihub:navigate-to-section', listener);
    };
  },
};

contextBridge.exposeInMainWorld('hagihub', hagihubApi);

export type HagihubApi = typeof hagihubApi;
