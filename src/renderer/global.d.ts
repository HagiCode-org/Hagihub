import type {
  AppInfo,
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  ExternalOpenResult,
  GitHubActionsResult,
  GitHubAccountsResult,
  OrgsResult,
  RepoDetailsResult,
  ReposResult,
  UpdateRepoPayload,
  UpdateRepoResult,
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
  fetchRepoDetails: (accountId: string, owner: string, repo: string) => Promise<RepoDetailsResult>;
  updateRepo: (accountId: string, owner: string, repo: string, updates: UpdateRepoPayload) => Promise<UpdateRepoResult>;
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
