import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  ExternalOpenResult,
  GitHubActionsResult,
  GitHubAccountsResult,
  GitHubManagedWorkflowReference,
  GitHubWorkflowDispatchRequest,
  GitHubWorkflowDispatchResponse,
  OrgsResult,
  ManagedActionsResult,
  RefreshManagedActionsResult,
  RepoDetailsResult,
  ReposResult,
  SearchGitHubWorkflowsResult,
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

const hagihubApi = {
  getAppInfo: () => ipcRenderer.invoke('hagihub:get-app-info') as Promise<AppInfo>,
  openExternal: (url: string) => ipcRenderer.invoke('hagihub:open-external', url) as Promise<ExternalOpenResult>,
  startDeviceFlow: () => ipcRenderer.invoke('hagihub:start-device-flow') as Promise<DeviceFlowStartResult>,
  cancelDeviceFlow: () => ipcRenderer.invoke('hagihub:cancel-device-flow') as Promise<DeviceFlowPollResult>,
  removeGitHubAccount: (accountId: string) => ipcRenderer.invoke('hagihub:remove-github-account', accountId) as Promise<GitHubAccountsResult>,
  getGitHubAccounts: () => ipcRenderer.invoke('hagihub:get-github-accounts') as Promise<GitHubAccountsResult>,
  switchGitHubAccount: (accountId: string) => ipcRenderer.invoke('hagihub:switch-github-account', accountId) as Promise<GitHubAccountsResult>,
  fetchGitHubRepos: (accountId: string) => ipcRenderer.invoke('hagihub:fetch-github-repos', accountId) as Promise<ReposResult>,
  fetchGitHubOrgs: (accountId: string) => ipcRenderer.invoke('hagihub:fetch-github-orgs', accountId) as Promise<OrgsResult>,
  fetchGitHubActions: (accountId: string, repoFullNames: string[]) => ipcRenderer.invoke('hagihub:fetch-github-actions', accountId, repoFullNames) as Promise<GitHubActionsResult>,
  fetchRepoDetails: (accountId: string, owner: string, repo: string) => ipcRenderer.invoke('hagihub:fetch-repo-details', accountId, owner, repo) as Promise<RepoDetailsResult>,
  updateRepo: (accountId: string, owner: string, repo: string, updates: UpdateRepoPayload) => ipcRenderer.invoke('hagihub:update-repo', accountId, owner, repo, updates) as Promise<UpdateRepoResult>,
  updateRepoTopics: (accountId: string, owner: string, repo: string, names: string[]) => ipcRenderer.invoke('hagihub:update-repo-topics', accountId, owner, repo, names) as Promise<UpdateRepoTopicsResult>,
  searchGitHubWorkflows: (accountId: string, query: string) => ipcRenderer.invoke('hagihub:search-github-workflows', accountId, query) as Promise<SearchGitHubWorkflowsResult>,
  getManagedActions: (accountId: string) => ipcRenderer.invoke('hagihub:get-managed-actions', accountId) as Promise<ManagedActionsResult>,
  saveManagedActions: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => ipcRenderer.invoke('hagihub:save-managed-actions', accountId, workflows) as Promise<ManagedActionsResult>,
  refreshManagedActionRuns: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => ipcRenderer.invoke('hagihub:refresh-managed-action-runs', accountId, workflows) as Promise<RefreshManagedActionsResult>,
  dispatchGitHubWorkflow: (accountId: string, request: GitHubWorkflowDispatchRequest) => ipcRenderer.invoke('hagihub:dispatch-github-workflow', accountId, request) as Promise<GitHubWorkflowDispatchResponse>,
};

contextBridge.exposeInMainWorld('hagihub', hagihubApi);

export type HagihubApi = typeof hagihubApi;
