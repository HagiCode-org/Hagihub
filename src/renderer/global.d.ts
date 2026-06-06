import type {
  AppInfo,
  CommitFilePayload,
  CommitFileResult,
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
  ManagedActionsResult,
  PullRequestResult,
  RefreshManagedActionsResult,
  RepoDetailsResult,
  ReposResult,
  SendNotificationParams,
  SendNotificationResult,
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
  fetchFileContent: (accountId: string, owner: string, repo: string, path: string) => Promise<FileContentResult>;
  commitFile: (accountId: string, owner: string, repo: string, path: string, payload: CommitFilePayload) => Promise<CommitFileResult>;
  createRef: (accountId: string, owner: string, repo: string, payload: CreateRefPayload) => Promise<void>;
  createPullRequest: (accountId: string, owner: string, repo: string, payload: CreatePullRequestPayload) => Promise<PullRequestResult>;
  updateRepo: (accountId: string, owner: string, repo: string, updates: UpdateRepoPayload) => Promise<UpdateRepoResult>;
  updateRepoTopics: (accountId: string, owner: string, repo: string, names: string[]) => Promise<UpdateRepoTopicsResult>;
  listGitHubRepoWorkflows: (accountId: string, repoFullName: string) => Promise<ListGitHubRepoWorkflowsResult>;
  searchGitHubWorkflows: (accountId: string, query: string) => Promise<SearchGitHubWorkflowsResult>;
  getManagedActions: (accountId: string) => Promise<ManagedActionsResult>;
  saveManagedActions: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => Promise<ManagedActionsResult>;
  refreshManagedActionRuns: (accountId: string, workflows: GitHubManagedWorkflowReference[]) => Promise<RefreshManagedActionsResult>;
  dispatchGitHubWorkflow: (accountId: string, request: GitHubWorkflowDispatchRequest) => Promise<GitHubWorkflowDispatchResponse>;
  sendNotification: (params: SendNotificationParams) => Promise<SendNotificationResult>;
  onNavigateToSection: (callback: (section: string) => void) => () => void;
}

declare global {
  interface WindowEventMap {
    'hagihub:device-flow-update': CustomEvent<DeviceFlowPollResult>;
    'hagihub:notification-shown': CustomEvent<string>;
    'hagihub:notification-clicked': CustomEvent<string>;
    'hagihub:navigate-to-section': CustomEvent<string>;
  }

  interface Window {
    hagihub: HagihubApi;
  }
}

export {};
