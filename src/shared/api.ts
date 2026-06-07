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

export interface GitHubRepoDetails {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  topics: string[];
  visibility: 'public' | 'private' | 'internal';
  defaultBranch: string;
  language: string | null;
  stargazersCount: number;
  forksCount: number;
  openIssuesCount: number;
  watchersCount: number;
  license: { name: string; spdxId: string | null } | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string | null;
}

export interface RepoDetailsResult {
  details: GitHubRepoDetails;
}

export interface FileContentResult {
  content: string;
  sha: string;
  exists: boolean;
}

export type ReadmeVariantRole = 'primary' | 'canonical-en' | 'localized';

export interface ReadmeVariant {
  path: string;
  locale: string;
  role: ReadmeVariantRole;
  exists: boolean;
  content: string;
  sha: string;
}

export interface ReadmeWorkspaceResult {
  variants: ReadmeVariant[];
}

export interface ReadmeWorkspaceVariantDraft {
  path: string;
  locale: string;
  role: ReadmeVariantRole;
  exists: boolean;
  sha: string;
  content: string;
  originalContent: string;
}

export type ReadmeBatchSubmissionStrategy = 'direct' | 'pull_request';

export interface SubmitReadmeWorkspacePayload {
  defaultBranch: string;
  strategy: ReadmeBatchSubmissionStrategy;
  commitMessage: string;
  branchName?: string;
  pullRequestTitle?: string;
  variants: ReadmeWorkspaceVariantDraft[];
}

export type ReadmeBatchSubmissionFileStatus = 'written' | 'skipped' | 'failed';

export interface ReadmeBatchSubmissionFileResult {
  path: string;
  locale: string;
  role: ReadmeVariantRole;
  attempted: boolean;
  status: ReadmeBatchSubmissionFileStatus;
  content: string;
  newSha?: string;
  error?: string;
  conflict?: boolean;
}

export interface ReadmeBatchSubmissionResult {
  success: boolean;
  strategy: ReadmeBatchSubmissionStrategy;
  branchName?: string;
  files: ReadmeBatchSubmissionFileResult[];
  pullRequest?: PullRequestResult;
  failedPath?: string;
  error?: string;
}

export interface CommitFilePayload {
  content: string;
  message: string;
  branch: string;
  sha?: string | null;
}

export interface CommitFileResult {
  newSha: string;
}

export interface CreateRefPayload {
  ref: string;
  sha: string;
}

export interface CreatePullRequestPayload {
  title: string;
  head: string;
  base: string;
}

export interface PullRequestResult {
  url: string;
  number: number;
  htmlUrl: string;
}

export interface UpdateRepoPayload {
  description?: string;
  homepage?: string;
}

export interface UpdateRepoResult {
  details: GitHubRepoDetails;
}

export interface UpdateRepoTopicsResult {
  names: string[];
}

export type GitHubRepoCreationOwnerType = 'personal' | 'organization';

export interface GitHubRepoCreationOwnerTarget {
  type: GitHubRepoCreationOwnerType;
  login: string;
}

export type GitHubRepoCreationVisibility = 'public' | 'private';

export interface CreateGitHubRepoPayload {
  owner: GitHubRepoCreationOwnerTarget;
  name: string;
  description?: string;
  visibility: GitHubRepoCreationVisibility;
  initializeWithReadme: boolean;
  gitignoreTemplate?: string | null;
  licenseTemplate?: string | null;
}

export type CreateGitHubRepoErrorCode =
  | 'duplicate'
  | 'validation'
  | 'permission_denied'
  | 'rate_limited'
  | 'network'
  | 'unauthorized'
  | 'unknown';

export interface CreateGitHubRepoFailure {
  success: false;
  errorCode: CreateGitHubRepoErrorCode;
  errorMessage: string;
  existingRepoUrl?: string;
}

export type CreateGitHubRepoResult =
  | {
    success: true;
    repo: GitHubRepo;
  }
  | CreateGitHubRepoFailure;

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

export type GitHubManagedWorkflowState = 'success' | 'failure' | 'in_progress' | 'waiting' | 'unavailable' | 'error';

export type SendNotificationLevel = 'info' | 'success' | 'warning' | 'error';

export type SendNotificationClickAction =
  | { type: 'open-url'; url: string }
  | { type: 'focus-window'; section?: string };

export interface SendNotificationParams {
  title: string;
  body: string;
  level: SendNotificationLevel;
  clickAction?: SendNotificationClickAction;
  duration?: number;
  icon?: string;
  silent?: boolean;
}

export interface SendNotificationResult {
  success: boolean;
  error?: string;
}

export type GitHubWorkflowDispatchInputType = 'string' | 'choice' | 'boolean' | 'number' | 'environment';

export interface GitHubWorkflowDispatchInputDefinition {
  name: string;
  description: string | null;
  required: boolean;
  defaultValue: string | null;
  type: GitHubWorkflowDispatchInputType;
  options: string[];
}

export interface GitHubManagedWorkflowReference {
  accountId: string;
  repoFullName: string;
  repoHtmlUrl: string;
  defaultBranch: string | null;
  workflowId: number;
  workflowName: string;
  workflowPath: string;
  workflowHtmlUrl: string;
  supportsDispatch: boolean;
  monitored?: boolean;
}

export interface GitHubWorkflowSummary extends GitHubManagedWorkflowReference {
  dispatchInputs: GitHubWorkflowDispatchInputDefinition[];
}

export interface GitHubManagedWorkflow extends GitHubWorkflowSummary {
  latestRun: GitHubWorkflowRun | null;
  latestRunState: GitHubManagedWorkflowState;
  lastScannedAt: string | null;
  refreshError: string | null;
}

export interface SearchGitHubWorkflowsResult {
  workflows: GitHubWorkflowSummary[];
  scannedRepoCount: number;
}

export interface ListGitHubRepoWorkflowsResult {
  repoFullName: string;
  workflows: GitHubWorkflowSummary[];
}

export interface ManagedActionsResult {
  workflows: GitHubManagedWorkflowReference[];
}

export interface RefreshManagedActionsResult {
  workflows: GitHubManagedWorkflow[];
  failedCount: number;
}

export interface GitHubWorkflowDispatchRequest {
  repoFullName: string;
  workflowId: number;
  ref?: string | null;
  inputs: Record<string, string>;
}

export interface GitHubWorkflowDispatchResponse {
  success: boolean;
  message: string;
  dispatchedAt: string;
}
