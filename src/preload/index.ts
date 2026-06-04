import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  ExternalOpenResult,
  GitHubActionsResult,
  GitHubAccountsResult,
  OrgsResult,
  ReposResult,
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
};

contextBridge.exposeInMainWorld('hagihub', hagihubApi);

export type HagihubApi = typeof hagihubApi;
