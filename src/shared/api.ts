export type PlatformId = 'linux-x64' | 'linux-arm64' | 'win-x64' | 'win-arm64' | 'osx-x64' | 'osx-arm64';

export interface AppInfo {
  appName: string;
  appVersion: string;
  platform: PlatformId;
  electronVersion: string;
  chromeVersion: string;
  nodeVersion: string;
  isPackaged: boolean;
  buildChannel: 'development' | 'production';
}

export interface ExternalOpenResult {
  success: boolean;
  error?: string;
}

export type GitHubTokenStorageMode = 'encrypted' | 'plaintext';

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

export interface GitHubOrg {
  id: number;
  login: string;
  avatarUrl: string;
  description: string | null;
}

export interface GitHubRepoOwner {
  login: string;
  avatarUrl: string;
  type: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  isPrivate: boolean;
  isFork: boolean;
  updatedAt: string;
  owner: GitHubRepoOwner;
}

export type GitHubActionRunState = 'running' | 'failed' | 'passed' | 'empty' | 'error';

export interface GitHubWorkflowRun {
  id: number;
  workflowName: string;
  displayTitle: string;
  htmlUrl: string;
  status: string;
  conclusion: string | null;
  event: string;
  branch: string | null;
  runNumber: number;
  attempt: number;
  updatedAt: string;
  createdAt: string;
}

export interface GitHubRepoActionsSummary {
  repoFullName: string;
  workflowCount: number;
  latestRun: GitHubWorkflowRun | null;
  state: GitHubActionRunState;
  scannedAt: string;
  error: string | null;
}

export interface GitHubAccount {
  id: string;
  login: string;
  avatarUrl: string;
  encryptedToken: string;
  addedAt: string;
  name?: string | null;
  storageMode?: GitHubTokenStorageMode;
}

export type GitHubAccountSummary = Omit<GitHubAccount, 'encryptedToken'>;

export interface DeviceFlowStartResult {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export interface DeviceFlowPollResult {
  flowId: string;
  status: 'pending' | 'success' | 'cancelled' | 'error' | 'expired';
  account?: GitHubAccountSummary;
  error?: string;
}

export interface GitHubAccountsResult {
  accounts: GitHubAccountSummary[];
  activeAccountId: string | null;
  recoveredCorruptedStorage?: boolean;
}

export interface ReposResult {
  repos: GitHubRepo[];
}

export interface OrgsResult {
  orgs: GitHubOrg[];
}

export interface GitHubActionsResult {
  summaries: GitHubRepoActionsSummary[];
  failedCount: number;
}
