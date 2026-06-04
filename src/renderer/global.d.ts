import type {
  AppInfo,
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  ExternalOpenResult,
  GitHubActionsResult,
  GitHubAccountsResult,
  OrgsResult,
  ReposResult,
} from '../shared/api';

interface HagihubApi {
  getAppInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => Promise<ExternalOpenResult>;
  startDeviceFlow: () => Promise<DeviceFlowStartResult>;
  cancelDeviceFlow: () => Promise<DeviceFlowPollResult>;
  removeGitHubAccount: (accountId: string) => Promise<GitHubAccountsResult>;
  getGitHubAccounts: () => Promise<GitHubAccountsResult>;
  switchGitHubAccount: (accountId: string) => Promise<GitHubAccountsResult>;
  fetchGitHubRepos: (accountId: string) => Promise<ReposResult>;
  fetchGitHubOrgs: (accountId: string) => Promise<OrgsResult>;
  fetchGitHubActions: (accountId: string, repoFullNames: string[]) => Promise<GitHubActionsResult>;
}

declare global {
  interface WindowEventMap {
    'hagihub:device-flow-update': CustomEvent<DeviceFlowPollResult>;
  }

  interface Window {
    hagihub: HagihubApi;
  }
}

export {};
