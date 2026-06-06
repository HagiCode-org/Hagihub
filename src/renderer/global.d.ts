import type {
  AppInfo,
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  ExternalOpenResult,
  GitHubActionsResult,
  GitHubAccountsResult,
  GitHubManagedWorkflowReference,
  ListGitHubRepoWorkflowsResult,
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
  updateRepoTopics: (accountId: string, owner: string, repo: string, names: string[]) => Promise<UpdateRepoTopicsResult>;
  listGitHubRepoWorkflows: (accountId: string, repoFullName: string) => Promise<ListGitHubRepoWorkflowsResult>;
  searchGitHubWorkflows: (accountId: string, query: string) => Promise<SearchGitHubWorkflowsResult>;
  getManagedActions: (accountId: string) => Promise<ManagedActionsResult>;
  saveManagedActions: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => Promise<ManagedActionsResult>;
  refreshManagedActionRuns: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => Promise<RefreshManagedActionsResult>;
  dispatchGitHubWorkflow: (accountId: string, request: GitHubWorkflowDispatchRequest) => Promise<GitHubWorkflowDispatchResponse>;
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
