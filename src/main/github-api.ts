import { load as loadYaml } from 'js-yaml';
import type {
  GitHubActionsResult,
  GitHubManagedWorkflow,
  GitHubManagedWorkflowReference,
  GitHubManagedWorkflowState,
  GitHubOrg,
  GitHubRepo,
  GitHubRepoActionsSummary,
  GitHubRepoDetails,
  GitHubUser,
  GitHubWorkflowDispatchInputDefinition,
  GitHubWorkflowDispatchInputType,
  GitHubWorkflowDispatchRequest,
  GitHubWorkflowDispatchResponse,
  GitHubWorkflowRun,
  GitHubWorkflowSummary,
  ListGitHubRepoWorkflowsResult,
  RefreshManagedActionsResult,
  SearchGitHubWorkflowsResult,
  UpdateRepoPayload,
  UpdateRepoTopicsResult,
} from '../shared/api.js';

const GITHUB_API_ROOT = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_USER_AGENT = 'Hagihub';
const SEARCH_REPO_NAME_MATCH_LIMIT = 16;
const SEARCH_WORKFLOW_SCAN_LIMIT = 20;
const SEARCH_WORKFLOWS_PER_REPO_LIMIT = 8;
const SEARCH_RESULT_LIMIT = 20;

type GitHubErrorCode = 'unauthorized' | 'forbidden' | 'network' | 'unknown';

interface RawGitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface RawGitHubOrg {
  id: number;
  login: string;
  avatar_url: string;
  description: string | null;
}

interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  fork: boolean;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    type: string;
  };
}

interface RawGitHubRepoDetails {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  topics: string[];
  visibility: 'public' | 'private' | 'internal';
  default_branch: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  license: { name: string; spdx_id: string | null } | null;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
}

interface RawGitHubWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
}

interface RawGitHubWorkflowsResponse {
  total_count: number;
  workflows: RawGitHubWorkflow[];
}

interface RawGitHubWorkflowRun {
  id: number;
  name: string;
  display_title: string;
  html_url: string;
  status: string;
  conclusion: string | null;
  event: string;
  head_branch: string | null;
  run_number: number;
  run_attempt: number;
  updated_at: string;
  created_at: string;
}

interface RawGitHubWorkflowRunsResponse {
  total_count: number;
  workflow_runs: RawGitHubWorkflowRun[];
}

interface RawGitHubContentFile {
  type: string;
  encoding?: string;
  content?: string;
}

interface WorkflowDispatchMetadata {
  supportsDispatch: boolean;
  inputs: GitHubWorkflowDispatchInputDefinition[];
}

export class GitHubApiError extends Error {
  readonly code: GitHubErrorCode;
  readonly status?: number;

  constructor(message: string, code: GitHubErrorCode, status?: number) {
    super(message);
    this.name = 'GitHubApiError';
    this.code = code;
    this.status = status;
  }
}

function buildHeaders(token: string): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'User-Agent': GITHUB_USER_AGENT,
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

async function readErrorMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const payload = await response.json() as { message?: string; errors?: Array<{ message?: string }> };
      const messages = [payload.message, ...(payload.errors ?? []).map((item) => item.message)]
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
      return messages.length > 0 ? messages.join(' ') : null;
    }

    const text = await response.text();
    return text.trim().length > 0 ? text.trim() : null;
  } catch {
    return null;
  }
}

async function assertResponse(response: Response): Promise<void> {
  if (response.ok) {
    return;
  }

  const detail = await readErrorMessage(response);

  if (response.status === 401) {
    throw new GitHubApiError(detail ?? 'GitHub token is invalid or expired.', 'unauthorized', response.status);
  }

  if (response.status === 403) {
    throw new GitHubApiError(detail ?? 'GitHub denied access because of rate limits or missing permissions.', 'forbidden', response.status);
  }

  throw new GitHubApiError(detail ?? `GitHub API request failed with status ${response.status}.`, 'unknown', response.status);
}

async function requestJson<T>(url: string, token: string, init?: RequestInit): Promise<{ data: T; response: Response }> {
  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...buildHeaders(token),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new GitHubApiError(
      error instanceof Error ? error.message : 'Network error while contacting GitHub.',
      'network',
    );
  }

  await assertResponse(response);
  const data = await response.json() as T;
  return { data, response };
}

function extractNextUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  const segments = linkHeader.split(',');

  for (const segment of segments) {
    const match = segment.match(/<([^>]+)>;\s*rel="next"/u);
    if (match) {
      return match[1];
    }
  }

  return null;
}

async function collectPaginated<T>(url: string, token: string): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;

  while (nextUrl) {
    const { data, response } = await requestJson<T[]>(nextUrl, token);
    results.push(...data);
    nextUrl = extractNextUrl(response.headers.get('link'));
  }

  return results;
}

function mapUser(user: RawGitHubUser): GitHubUser {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    htmlUrl: user.html_url,
  };
}

function mapOrg(org: RawGitHubOrg): GitHubOrg {
  return {
    id: org.id,
    login: org.login,
    avatarUrl: org.avatar_url,
    description: org.description,
  };
}

function mapRepo(repo: RawGitHubRepo): GitHubRepo {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    htmlUrl: repo.html_url,
    isPrivate: repo.private,
    isFork: repo.fork,
    updatedAt: repo.updated_at,
    owner: {
      login: repo.owner.login,
      avatarUrl: repo.owner.avatar_url,
      type: repo.owner.type,
    },
  };
}

function mapWorkflowRun(run: RawGitHubWorkflowRun): GitHubWorkflowRun {
  return {
    id: run.id,
    workflowName: run.name,
    displayTitle: run.display_title,
    htmlUrl: run.html_url,
    status: run.status,
    conclusion: run.conclusion,
    event: run.event,
    branch: run.head_branch,
    runNumber: run.run_number,
    attempt: run.run_attempt,
    updatedAt: run.updated_at,
    createdAt: run.created_at,
  };
}

function normalizeScalar(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function resolveDispatchInputType(value: unknown): GitHubWorkflowDispatchInputType {
  if (value === 'boolean' || value === 'choice' || value === 'number' || value === 'environment') {
    return value;
  }

  return 'string';
}

function resolveDispatchNode(onValue: unknown): unknown {
  if (typeof onValue === 'string') {
    return onValue === 'workflow_dispatch' ? {} : undefined;
  }

  if (Array.isArray(onValue)) {
    return onValue.includes('workflow_dispatch') ? {} : undefined;
  }

  if (typeof onValue === 'object' && onValue !== null) {
    const record = onValue as Record<string, unknown>;
    if (Object.hasOwn(record, 'workflow_dispatch')) {
      return record.workflow_dispatch;
    }
  }

  return undefined;
}

function normalizeDispatchInputs(value: unknown): GitHubWorkflowDispatchInputDefinition[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }

  return Object.entries(value as Record<string, unknown>).map(([name, definition]) => {
    const record = typeof definition === 'object' && definition !== null
      ? definition as Record<string, unknown>
      : {};

    return {
      name,
      description: typeof record.description === 'string' ? record.description : null,
      required: record.required === true,
      defaultValue: normalizeScalar(record.default),
      type: resolveDispatchInputType(record.type),
      options: Array.isArray(record.options)
        ? record.options
          .map((option) => normalizeScalar(option))
          .filter((option): option is string => option !== null)
        : [],
    } satisfies GitHubWorkflowDispatchInputDefinition;
  });
}

export function extractWorkflowDispatchMetadata(content: string): WorkflowDispatchMetadata {
  const parsed = loadYaml(content) as unknown;

  if (typeof parsed !== 'object' || parsed === null) {
    return { supportsDispatch: false, inputs: [] };
  }

  const root = parsed as Record<string, unknown>;
  const onValue = Object.hasOwn(root, 'on')
    ? root.on
    : Object.hasOwn(root, 'true')
      ? root.true
      : undefined;
  const workflowDispatch = resolveDispatchNode(onValue);

  if (workflowDispatch === undefined) {
    return { supportsDispatch: false, inputs: [] };
  }

  if (typeof workflowDispatch !== 'object' || workflowDispatch === null) {
    return { supportsDispatch: true, inputs: [] };
  }

  const record = workflowDispatch as Record<string, unknown>;
  return {
    supportsDispatch: true,
    inputs: normalizeDispatchInputs(record.inputs),
  };
}

export function resolveManagedWorkflowState(run: GitHubWorkflowRun | null): GitHubManagedWorkflowState {
  if (!run) {
    return 'unavailable';
  }

  if (run.status === 'queued' || run.status === 'requested' || run.status === 'pending' || run.status === 'waiting') {
    return 'waiting';
  }

  if (run.status !== 'completed') {
    return 'in_progress';
  }

  if (run.conclusion === 'success' || run.conclusion === 'neutral' || run.conclusion === 'skipped') {
    return 'success';
  }

  if (
    run.conclusion === 'failure'
    || run.conclusion === 'timed_out'
    || run.conclusion === 'cancelled'
    || run.conclusion === 'action_required'
    || run.conclusion === 'startup_failure'
    || run.conclusion === 'stale'
  ) {
    return 'failure';
  }

  return 'error';
}

function resolveRunState(run: GitHubWorkflowRun | null): GitHubRepoActionsSummary['state'] {
  const state = resolveManagedWorkflowState(run);

  if (state === 'success') {
    return 'passed';
  }

  if (state === 'failure') {
    return 'failed';
  }

  if (state === 'in_progress' || state === 'waiting') {
    return 'running';
  }

  if (state === 'unavailable') {
    return 'empty';
  }

  return 'error';
}

function mapRepoDetails(repo: RawGitHubRepoDetails): GitHubRepoDetails {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    htmlUrl: repo.html_url,
    homepage: repo.homepage,
    topics: repo.topics ?? [],
    visibility: repo.visibility,
    defaultBranch: repo.default_branch,
    language: repo.language,
    stargazersCount: repo.stargazers_count,
    forksCount: repo.forks_count,
    openIssuesCount: repo.open_issues_count,
    watchersCount: repo.watchers_count,
    license: repo.license ? { name: repo.license.name, spdxId: repo.license.spdx_id } : null,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    pushedAt: repo.pushed_at,
  };
}

function splitRepoFullName(repoFullName: string): { owner: string; repo: string } {
  const [owner, repo] = repoFullName.split('/');

  if (!owner || !repo) {
    throw new Error(`Invalid repository name: ${repoFullName}`);
  }

  return { owner, repo };
}

function encodeRepoPath(repoPath: string): string {
  return repoPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

function repoMatchesQuery(repo: GitHubRepo, query: string): boolean {
  return repo.fullName.toLowerCase().includes(query)
    || repo.name.toLowerCase().includes(query)
    || (repo.description ?? '').toLowerCase().includes(query);
}

function workflowMatchesQuery(workflow: RawGitHubWorkflow, query: string): boolean {
  return workflow.name.toLowerCase().includes(query) || workflow.path.toLowerCase().includes(query);
}

function dedupeRepos(repos: GitHubRepo[]): GitHubRepo[] {
  const seen = new Set<string>();
  return repos.filter((repo) => {
    if (seen.has(repo.fullName)) {
      return false;
    }

    seen.add(repo.fullName);
    return true;
  });
}

function summarizeError(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return 'Unknown GitHub workflow error.';
}

function toManagedWorkflowSummary(
  reference: GitHubManagedWorkflowReference,
  dispatchMetadata: WorkflowDispatchMetadata,
): GitHubWorkflowSummary {
  return {
    ...reference,
    supportsDispatch: dispatchMetadata.supportsDispatch,
    dispatchInputs: dispatchMetadata.inputs,
  };
}

function toManagedWorkflowError(
  reference: GitHubManagedWorkflowReference,
  error: unknown,
  state: GitHubManagedWorkflowState,
): GitHubManagedWorkflow {
  return {
    ...reference,
    supportsDispatch: reference.supportsDispatch,
    dispatchInputs: [],
    latestRun: null,
    latestRunState: state,
    lastScannedAt: new Date().toISOString(),
    refreshError: summarizeError(error),
  };
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<TResult>,
): Promise<TResult[]> {
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function fetchRepoWorkflowList(token: string, owner: string, repo: string): Promise<RawGitHubWorkflow[]> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const { data } = await requestJson<RawGitHubWorkflowsResponse>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/actions/workflows?per_page=100`,
    token,
  );

  return data.workflows ?? [];
}

async function fetchWorkflowDetail(token: string, owner: string, repo: string, workflowId: number): Promise<RawGitHubWorkflow> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const { data } = await requestJson<RawGitHubWorkflow>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/actions/workflows/${workflowId}`,
    token,
  );

  return data;
}

async function fetchWorkflowFileContent(
  token: string,
  owner: string,
  repo: string,
  workflowPath: string,
  ref?: string | null,
): Promise<string> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const encodedPath = encodeRepoPath(workflowPath);
  const refSuffix = ref ? `?ref=${encodeURIComponent(ref)}` : '';

  try {
    const { data } = await requestJson<RawGitHubContentFile>(
      `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}${refSuffix}`,
      token,
    );

    if (data.type !== 'file' || data.encoding !== 'base64' || typeof data.content !== 'string') {
      throw new Error(`Workflow file ${workflowPath} is not a readable file.`);
    }

    return Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  } catch (error) {
    if (ref && error instanceof GitHubApiError && error.status === 404) {
      return await fetchWorkflowFileContent(token, owner, repo, workflowPath, null);
    }

    throw error;
  }
}

async function fetchWorkflowDispatchMetadata(
  token: string,
  owner: string,
  repo: string,
  workflowPath: string,
  ref?: string | null,
): Promise<WorkflowDispatchMetadata> {
  const content = await fetchWorkflowFileContent(token, owner, repo, workflowPath, ref);
  return extractWorkflowDispatchMetadata(content);
}

async function fetchLatestWorkflowRun(token: string, owner: string, repo: string, workflowId: number): Promise<GitHubWorkflowRun | null> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const { data } = await requestJson<RawGitHubWorkflowRunsResponse>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/actions/workflows/${workflowId}/runs?per_page=1`,
    token,
  );

  return data.workflow_runs.length > 0 ? mapWorkflowRun(data.workflow_runs[0]) : null;
}

async function fetchRepoActionsSummary(token: string, repoFullName: string): Promise<GitHubRepoActionsSummary> {
  const { owner, repo } = splitRepoFullName(repoFullName);
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const { data } = await requestJson<RawGitHubWorkflowRunsResponse>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/actions/runs?per_page=1`,
    token,
  );
  const latestRun = data.workflow_runs.length > 0 ? mapWorkflowRun(data.workflow_runs[0]) : null;

  return {
    repoFullName,
    workflowCount: data.total_count,
    latestRun,
    state: resolveRunState(latestRun),
    scannedAt: new Date().toISOString(),
    error: null,
  };
}

function buildDispatchInputsPayload(
  requestInputs: Record<string, string>,
  metadata: WorkflowDispatchMetadata,
): Record<string, string> {
  const definitions = new Map(metadata.inputs.map((input) => [input.name, input]));
  const payload: Record<string, string> = {};

  for (const [name, value] of Object.entries(requestInputs)) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalizedValue = value.trim();
    if (!definitions.has(name) && metadata.inputs.length > 0) {
      continue;
    }

    if (normalizedValue.length > 0) {
      payload[name] = normalizedValue;
    }
  }

  for (const definition of metadata.inputs) {
    const currentValue = payload[definition.name] ?? definition.defaultValue;
    if (definition.required && (!currentValue || currentValue.trim().length === 0)) {
      throw new Error(`Missing required workflow input: ${definition.name}`);
    }

    if (currentValue && currentValue.trim().length > 0) {
      payload[definition.name] = currentValue.trim();
    }
  }

  return payload;
}

async function resolveDefaultBranch(token: string, owner: string, repo: string, fallback?: string | null): Promise<string> {
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }

  const details = await fetchRepoDetails(token, owner, repo);
  return details.defaultBranch;
}

async function hydrateManagedWorkflow(token: string, reference: GitHubManagedWorkflowReference): Promise<GitHubManagedWorkflow> {
  let repoParts: { owner: string; repo: string };

  try {
    repoParts = splitRepoFullName(reference.repoFullName);
  } catch (error) {
    return toManagedWorkflowError(reference, error, 'error');
  }

  const { owner, repo } = repoParts;

  let workflow: RawGitHubWorkflow;
  try {
    workflow = await fetchWorkflowDetail(token, owner, repo, reference.workflowId);
  } catch (error) {
    const state = error instanceof GitHubApiError && error.status === 404 ? 'unavailable' : 'error';
    return toManagedWorkflowError(reference, error, state);
  }

  const nextReference: GitHubManagedWorkflowReference = {
    ...reference,
    workflowName: workflow.name,
    workflowPath: workflow.path,
    workflowHtmlUrl: workflow.html_url,
  };

  let defaultBranch: string | null = reference.defaultBranch;
  if (!defaultBranch) {
    try {
      defaultBranch = await resolveDefaultBranch(token, owner, repo);
    } catch {
      defaultBranch = null;
    }
  }

  const [metadataResult, latestRunResult] = await Promise.allSettled([
    fetchWorkflowDispatchMetadata(token, owner, repo, workflow.path, defaultBranch),
    fetchLatestWorkflowRun(token, owner, repo, workflow.id),
  ]);

  const dispatchMetadata = metadataResult.status === 'fulfilled'
    ? metadataResult.value
    : { supportsDispatch: reference.supportsDispatch, inputs: [] } satisfies WorkflowDispatchMetadata;
  const latestRun = latestRunResult.status === 'fulfilled' ? latestRunResult.value : null;
  const latestRunState = latestRunResult.status === 'fulfilled'
    ? resolveManagedWorkflowState(latestRun)
    : latestRunResult.reason instanceof GitHubApiError && latestRunResult.reason.status === 404
      ? 'unavailable'
      : 'error';
  const refreshError = metadataResult.status === 'rejected'
    ? summarizeError(metadataResult.reason)
    : latestRunResult.status === 'rejected'
      ? summarizeError(latestRunResult.reason)
      : null;

  return {
    ...nextReference,
    defaultBranch,
    supportsDispatch: dispatchMetadata.supportsDispatch,
    dispatchInputs: dispatchMetadata.inputs,
    latestRun,
    latestRunState,
    lastScannedAt: new Date().toISOString(),
    refreshError,
  };
}

export async function fetchUser(token: string): Promise<GitHubUser> {
  const { data } = await requestJson<RawGitHubUser>(`${GITHUB_API_ROOT}/user`, token);
  return mapUser(data);
}

export async function fetchOrgs(token: string): Promise<GitHubOrg[]> {
  const orgs = await collectPaginated<RawGitHubOrg>(`${GITHUB_API_ROOT}/user/orgs?per_page=100`, token);
  return orgs.map(mapOrg);
}

export async function fetchRepos(token: string): Promise<GitHubRepo[]> {
  const repos = await collectPaginated<RawGitHubRepo>(
    `${GITHUB_API_ROOT}/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=updated`,
    token,
  );

  return repos.map(mapRepo);
}

export async function fetchRepoDetails(token: string, owner: string, repo: string): Promise<GitHubRepoDetails> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const { data } = await requestJson<RawGitHubRepoDetails>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}`,
    token,
  );
  return mapRepoDetails(data);
}

export async function updateRepo(token: string, owner: string, repo: string, updates: UpdateRepoPayload): Promise<GitHubRepoDetails> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  let response: Response;

  try {
    response = await fetch(`${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}`, {
      method: 'PATCH',
      headers: {
        ...buildHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
  } catch (error) {
    throw new GitHubApiError(
      error instanceof Error ? error.message : 'Network error while updating repository.',
      'network',
    );
  }

  await assertResponse(response);
  const data = await response.json() as RawGitHubRepoDetails;
  return mapRepoDetails(data);
}

export async function updateRepoTopics(token: string, owner: string, repo: string, names: string[]): Promise<UpdateRepoTopicsResult> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  let response: Response;

  try {
    response = await fetch(`${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/topics`, {
      method: 'PUT',
      headers: {
        ...buildHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ names }),
    });
  } catch (error) {
    throw new GitHubApiError(
      error instanceof Error ? error.message : 'Network error while updating repository topics.',
      'network',
    );
  }

  await assertResponse(response);
  const data = await response.json() as { names: string[] };
  return { names: data.names ?? [] };
}

export async function fetchActionsSummaries(token: string, repoFullNames: string[]): Promise<GitHubActionsResult> {
  let failedCount = 0;

  const summaries = await mapWithConcurrency(repoFullNames, 4, async (repoFullName) => {
    try {
      return await fetchRepoActionsSummary(token, repoFullName);
    } catch (error) {
      if (error instanceof GitHubApiError && (error.code === 'unauthorized' || error.code === 'network')) {
        throw error;
      }

      failedCount += 1;

      return {
        repoFullName,
        workflowCount: 0,
        latestRun: null,
        state: 'error',
        scannedAt: new Date().toISOString(),
        error: summarizeError(error),
      } satisfies GitHubRepoActionsSummary;
    }
  });

  return {
    summaries,
    failedCount,
  };
}

export async function searchGitHubWorkflows(
  token: string,
  accountId: string,
  query: string,
): Promise<SearchGitHubWorkflowsResult> {
  const normalizedQuery = normalizeQuery(query);
  if (normalizedQuery.length === 0) {
    return {
      workflows: [],
      scannedRepoCount: 0,
    };
  }

  const repos = await fetchRepos(token);
  const repoNameMatches = repos.filter((repo) => repoMatchesQuery(repo, normalizedQuery));
  const workflowScanRepos = repos.filter((repo) => !repoMatchesQuery(repo, normalizedQuery));
  const candidateRepos = dedupeRepos([
    ...repoNameMatches.slice(0, SEARCH_REPO_NAME_MATCH_LIMIT),
    ...workflowScanRepos.slice(0, SEARCH_WORKFLOW_SCAN_LIMIT),
  ]);

  const perRepoResults = await mapWithConcurrency(candidateRepos, 4, async (repo) => {
    try {
      const repoMatch = repoMatchesQuery(repo, normalizedQuery);
      const rawWorkflows = await fetchRepoWorkflowList(token, repo.owner.login, repo.name);
      const matchingWorkflows = rawWorkflows
        .filter((workflow) => repoMatch || workflowMatchesQuery(workflow, normalizedQuery))
        .slice(0, SEARCH_WORKFLOWS_PER_REPO_LIMIT);

      if (matchingWorkflows.length === 0) {
        return [] as GitHubWorkflowSummary[];
      }

      const repoDetails = await fetchRepoDetails(token, repo.owner.login, repo.name);

      return await mapWithConcurrency(matchingWorkflows, 2, async (workflow) => {
        let dispatchMetadata: WorkflowDispatchMetadata = { supportsDispatch: false, inputs: [] };

        try {
          dispatchMetadata = await fetchWorkflowDispatchMetadata(
            token,
            repo.owner.login,
            repo.name,
            workflow.path,
            repoDetails.defaultBranch,
          );
        } catch {
          dispatchMetadata = { supportsDispatch: false, inputs: [] };
        }

        return toManagedWorkflowSummary(
          {
            accountId,
            repoFullName: repo.fullName,
            repoHtmlUrl: repo.htmlUrl,
            defaultBranch: repoDetails.defaultBranch,
            workflowId: workflow.id,
            workflowName: workflow.name,
            workflowPath: workflow.path,
            workflowHtmlUrl: workflow.html_url,
            supportsDispatch: dispatchMetadata.supportsDispatch,
          },
          dispatchMetadata,
        );
      });
    } catch (error) {
      if (error instanceof GitHubApiError && (error.code === 'unauthorized' || error.code === 'network')) {
        throw error;
      }

      console.warn('[github-api] Skipping workflow search for repository', {
        repoFullName: repo.fullName,
        error: summarizeError(error),
      });
      return [] as GitHubWorkflowSummary[];
    }
  });

  return {
    workflows: perRepoResults.flat().slice(0, SEARCH_RESULT_LIMIT),
    scannedRepoCount: candidateRepos.length,
  };
}

export async function listGitHubRepoWorkflows(
  token: string,
  accountId: string,
  repoFullName: string,
): Promise<ListGitHubRepoWorkflowsResult> {
  const { owner, repo } = splitRepoFullName(repoFullName);
  const repoDetails = await fetchRepoDetails(token, owner, repo);
  const rawWorkflows = await fetchRepoWorkflowList(token, owner, repo);

  const workflows = await mapWithConcurrency(rawWorkflows, 2, async (workflow) => {
    let dispatchMetadata: WorkflowDispatchMetadata = { supportsDispatch: false, inputs: [] };

    try {
      dispatchMetadata = await fetchWorkflowDispatchMetadata(
        token,
        owner,
        repo,
        workflow.path,
        repoDetails.defaultBranch,
      );
    } catch {
      dispatchMetadata = { supportsDispatch: false, inputs: [] };
    }

    return toManagedWorkflowSummary(
      {
        accountId,
        repoFullName: repoDetails.fullName,
        repoHtmlUrl: repoDetails.htmlUrl,
        defaultBranch: repoDetails.defaultBranch,
        workflowId: workflow.id,
        workflowName: workflow.name,
        workflowPath: workflow.path,
        workflowHtmlUrl: workflow.html_url,
        supportsDispatch: dispatchMetadata.supportsDispatch,
      },
      dispatchMetadata,
    );
  });

  return {
    repoFullName: repoDetails.fullName,
    workflows,
  };
}

export async function refreshManagedActionRuns(
  token: string,
  workflows: GitHubManagedWorkflowReference[],
): Promise<RefreshManagedActionsResult> {
  const refreshed = await mapWithConcurrency(workflows, 4, async (workflow) => {
    return await hydrateManagedWorkflow(token, workflow);
  });

  return {
    workflows: refreshed,
    failedCount: refreshed.filter((workflow) => workflow.refreshError !== null).length,
  };
}

export async function dispatchGitHubWorkflow(
  token: string,
  request: GitHubWorkflowDispatchRequest,
): Promise<GitHubWorkflowDispatchResponse> {
  const { owner, repo } = splitRepoFullName(request.repoFullName);
  const workflow = await fetchWorkflowDetail(token, owner, repo, request.workflowId);
  const ref = await resolveDefaultBranch(token, owner, repo, request.ref);
  const dispatchMetadata = await fetchWorkflowDispatchMetadata(token, owner, repo, workflow.path, ref);

  if (!dispatchMetadata.supportsDispatch) {
    throw new Error('This workflow does not declare workflow_dispatch.');
  }

  const inputs = buildDispatchInputsPayload(request.inputs, dispatchMetadata);
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  let response: Response;

  try {
    response = await fetch(
      `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/actions/workflows/${request.workflowId}/dispatches`,
      {
        method: 'POST',
        headers: {
          ...buildHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref,
          inputs,
        }),
      },
    );
  } catch (error) {
    throw new GitHubApiError(
      error instanceof Error ? error.message : 'Network error while dispatching workflow.',
      'network',
    );
  }

  await assertResponse(response);

  return {
    success: true,
    message: `Workflow dispatched to ${ref}.`,
    dispatchedAt: new Date().toISOString(),
  };
}
