import { load as loadYaml } from 'js-yaml';
import type {
  CommitFilePayload,
  CommitFileResult,
  CreateGitHubRepoErrorCode,
  CreateGitHubRepoFailure,
  CreateGitHubRepoPayload,
  CreateGitHubRepoResult,
  FileContentResult,
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
  PullRequestResult,
  ReadmeBatchSubmissionResult,
  ReadmeVariant,
  ReadmeVariantRole,
  ReadmeWorkspaceResult,
  RefreshManagedActionsResult,
  SearchGitHubWorkflowsResult,
  SubmitReadmeWorkspacePayload,
  UpdateRepoPayload,
  UpdateRepoTopicsResult,
} from '../shared/api.js';
import { buildGitHubRepoUrl } from '../shared/github-special-repos.js';

const GITHUB_API_ROOT = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_USER_AGENT = 'Hagihub';
const SEARCH_REPO_NAME_MATCH_LIMIT = 16;
const SEARCH_WORKFLOW_SCAN_LIMIT = 20;
const SEARCH_WORKFLOWS_PER_REPO_LIMIT = 8;
const SEARCH_RESULT_LIMIT = 20;
const PRIMARY_README_PATH = 'README.md';
const CANONICAL_ENGLISH_README_PATH = 'README_en-us.md';
const README_VARIANT_PATTERN = /^README_([A-Za-z0-9_-]+)\.md$/u;
const README_LANGUAGE_REGION_START = '<!-- hagihub:readme-languages:start -->';
const README_LANGUAGE_REGION_END = '<!-- hagihub:readme-languages:end -->';

const README_LANGUAGE_LABELS: Record<string, string> = {
  'en-us': 'English (US)',
  'zh-cn': 'Chinese (Simplified)',
  'ja-jp': 'Japanese',
  'ko-kr': 'Korean',
  'fr-fr': 'French',
  'de-de': 'German',
  'es-es': 'Spanish',
  'pt-br': 'Portuguese (Brazil)',
};

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
  name?: string;
  path?: string;
  sha?: string;
  encoding?: string;
  content?: string;
}

interface PreparedReadmeVariant extends ReadmeVariant {
  originalContent: string;
  changed: boolean;
}

interface RawGitHubRefResponse {
  ref: string;
  object?: {
    sha?: string;
  };
}

interface RawGitHubCommitFileResponse {
  content?: {
    sha?: string;
  };
}

interface RawGitHubPullRequest {
  url: string;
  number: number;
  html_url: string;
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

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildCreateGitHubRepoFailure(
  errorCode: CreateGitHubRepoErrorCode,
  errorMessage: string,
  options?: {
    existingRepoUrl?: string;
  },
): CreateGitHubRepoFailure {
  return {
    success: false,
    errorCode,
    errorMessage,
    ...(options?.existingRepoUrl ? { existingRepoUrl: options.existingRepoUrl } : {}),
  };
}

function isDuplicateCreateRepoDetail(detail: string | null): boolean {
  const normalizedDetail = detail?.toLowerCase();

  if (!normalizedDetail) {
    return false;
  }

  return normalizedDetail.includes('name already exists')
    || normalizedDetail.includes('already exists');
}

function extractGitHubRepoUrl(detail: string | null): string | undefined {
  const match = detail?.match(/https:\/\/github\.com\/[^\s"')>]+/iu);
  return match?.[0];
}

function isRateLimitResponse(response: Response, detail: string | null): boolean {
  const remaining = response.headers.get('x-ratelimit-remaining');

  return remaining === '0'
    || (detail?.toLowerCase().includes('rate limit') ?? false)
    || response.status === 429;
}

function mapCreateGitHubRepoFailure(
  response: Response,
  detail: string | null,
  payload: CreateGitHubRepoPayload,
): CreateGitHubRepoFailure {
  if (response.status === 401) {
    return buildCreateGitHubRepoFailure(
      'unauthorized',
      detail ?? 'GitHub authentication expired. Reconnect this account and try again.',
    );
  }

  if (isRateLimitResponse(response, detail)) {
    return buildCreateGitHubRepoFailure(
      'rate_limited',
      detail ?? 'GitHub rate limits prevented repository creation. Wait a moment and try again.',
    );
  }

  if (response.status === 403) {
    return buildCreateGitHubRepoFailure(
      'permission_denied',
      detail ?? 'GitHub denied permission to create a repository for the selected owner.',
    );
  }

  if (response.status === 422 && isDuplicateCreateRepoDetail(detail)) {
    return buildCreateGitHubRepoFailure(
      'duplicate',
      detail ?? 'A repository with this name already exists for the selected owner.',
      {
        existingRepoUrl: extractGitHubRepoUrl(detail) ?? buildGitHubRepoUrl(payload.owner.login, payload.name),
      },
    );
  }

  if (response.status === 400 || response.status === 422) {
    return buildCreateGitHubRepoFailure(
      'validation',
      detail ?? 'GitHub rejected the repository settings. Review the name and initialization options, then try again.',
    );
  }

  return buildCreateGitHubRepoFailure(
    'unknown',
    detail ?? `GitHub could not create the repository (status ${response.status}).`,
  );
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeReadmeLocale(locale: string): string {
  return locale
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function resolveReadmeVariantMetadata(path: string): { locale: string; role: ReadmeVariantRole } | null {
  if (path === PRIMARY_README_PATH) {
    return {
      locale: 'en-us',
      role: 'primary',
    };
  }

  const match = path.match(README_VARIANT_PATTERN);
  if (!match) {
    return null;
  }

  const locale = normalizeReadmeLocale(match[1]);
  if (!locale) {
    return null;
  }

  return {
    locale,
    role: locale === 'en-us' ? 'canonical-en' : 'localized',
  };
}

function compareReadmeVariantDisplayOrder(
  left: Pick<ReadmeVariant, 'path' | 'locale' | 'role'>,
  right: Pick<ReadmeVariant, 'path' | 'locale' | 'role'>,
): number {
  const rank = (role: ReadmeVariantRole): number => {
    if (role === 'primary') {
      return 0;
    }

    if (role === 'canonical-en') {
      return 1;
    }

    return 2;
  };

  const roleComparison = rank(left.role) - rank(right.role);
  if (roleComparison !== 0) {
    return roleComparison;
  }

  const localeComparison = left.locale.localeCompare(right.locale);
  return localeComparison !== 0 ? localeComparison : left.path.localeCompare(right.path);
}

function compareReadmeWriteOrder(left: PreparedReadmeVariant, right: PreparedReadmeVariant): number {
  const rank = (role: ReadmeVariantRole): number => {
    if (role === 'localized') {
      return 0;
    }

    if (role === 'canonical-en') {
      return 1;
    }

    return 2;
  };

  const roleComparison = rank(left.role) - rank(right.role);
  if (roleComparison !== 0) {
    return roleComparison;
  }

  const localeComparison = left.locale.localeCompare(right.locale);
  return localeComparison !== 0 ? localeComparison : left.path.localeCompare(right.path);
}

function buildReadmeLanguageLabel(role: ReadmeVariantRole, locale: string): string {
  if (role === 'primary') {
    return 'English';
  }

  return README_LANGUAGE_LABELS[locale] ?? locale.toUpperCase();
}

function collectManagedReadmePaths(entries: RawGitHubContentFile[]): string[] {
  const paths = new Set<string>([PRIMARY_README_PATH, CANONICAL_ENGLISH_README_PATH]);

  for (const entry of entries) {
    if (entry.type !== 'file' || typeof entry.path !== 'string' || entry.path.includes('/')) {
      continue;
    }

    if (resolveReadmeVariantMetadata(entry.path)) {
      paths.add(entry.path);
    }
  }

  return Array.from(paths).sort((left, right) => {
    const leftMetadata = resolveReadmeVariantMetadata(left);
    const rightMetadata = resolveReadmeVariantMetadata(right);

    if (!leftMetadata || !rightMetadata) {
      return left.localeCompare(right);
    }

    return compareReadmeVariantDisplayOrder({ path: left, ...leftMetadata }, { path: right, ...rightMetadata });
  });
}

async function fetchRootContents(token: string, owner: string, repo: string): Promise<RawGitHubContentFile[]> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const { data } = await requestJson<RawGitHubContentFile[] | RawGitHubContentFile>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/contents`,
    token,
  );

  if (!Array.isArray(data)) {
    throw new GitHubApiError('Repository root is not a readable directory.', 'unknown');
  }

  return data;
}

function mirrorCanonicalEnglishVariants(variants: ReadmeVariant[]): ReadmeVariant[] {
  const nextVariants = variants.map((variant) => ({ ...variant }));
  const primary = nextVariants.find((variant) => variant.path === PRIMARY_README_PATH);
  const canonical = nextVariants.find((variant) => variant.path === CANONICAL_ENGLISH_README_PATH);

  if (!primary || !canonical) {
    return nextVariants;
  }

  const sourceContent = canonical.exists ? canonical.content : primary.content;
  primary.content = sourceContent;
  canonical.content = sourceContent;
  return nextVariants;
}

function stripReadmeLanguageRegion(content: string): string {
  const regionPattern = new RegExp(
    `${escapeRegExp(README_LANGUAGE_REGION_START)}\\n?[\\s\\S]*?${escapeRegExp(README_LANGUAGE_REGION_END)}\\n*`,
    'u',
  );

  return content.replace(/^\uFEFF/u, '').replace(regionPattern, '').replace(/^\n{3,}/u, '\n\n');
}

function splitReadmeFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^(---\n[\s\S]*?\n---)(\n|$)/u);
  if (!match) {
    return { frontmatter: '', body: content };
  }

  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
  };
}

export function buildReadmeLanguageRegion(variants: Pick<ReadmeVariant, 'path' | 'locale' | 'role'>[]): string {
  const links = [...variants]
    .sort(compareReadmeVariantDisplayOrder)
    .map((variant) => `[${buildReadmeLanguageLabel(variant.role, variant.locale)}](./${variant.path})`)
    .join(' | ');

  return `${README_LANGUAGE_REGION_START}\n> Languages: ${links}\n${README_LANGUAGE_REGION_END}`;
}

export function normalizeReadmeVariantContent(
  content: string,
  variants: Pick<ReadmeVariant, 'path' | 'locale' | 'role'>[],
): string {
  const strippedContent = stripReadmeLanguageRegion(content);
  const { frontmatter, body } = splitReadmeFrontmatter(strippedContent);
  const normalizedRegion = buildReadmeLanguageRegion(variants);
  const trimmedBody = body.replace(/^\n+/u, '');

  if (frontmatter) {
    return trimmedBody.length > 0
      ? `${frontmatter}\n\n${normalizedRegion}\n\n${trimmedBody}`
      : `${frontmatter}\n\n${normalizedRegion}\n`;
  }

  return trimmedBody.length > 0
    ? `${normalizedRegion}\n\n${trimmedBody}`
    : `${normalizedRegion}\n`;
}

function buildPreparedReadmeVariants(variants: SubmitReadmeWorkspacePayload['variants']): PreparedReadmeVariant[] {
  const mapped = new Map<string, PreparedReadmeVariant>();

  for (const variant of variants) {
    const metadata = resolveReadmeVariantMetadata(variant.path) ?? {
      locale: normalizeReadmeLocale(variant.locale),
      role: variant.role,
    };

    mapped.set(variant.path, {
      path: variant.path,
      locale: metadata.locale,
      role: metadata.role,
      exists: variant.exists,
      sha: variant.sha,
      content: variant.content,
      originalContent: variant.originalContent,
      changed: false,
    });
  }

  if (!mapped.has(PRIMARY_README_PATH)) {
    mapped.set(PRIMARY_README_PATH, {
      path: PRIMARY_README_PATH,
      locale: 'en-us',
      role: 'primary',
      exists: false,
      sha: '',
      content: '',
      originalContent: '',
      changed: false,
    });
  }

  if (!mapped.has(CANONICAL_ENGLISH_README_PATH)) {
    mapped.set(CANONICAL_ENGLISH_README_PATH, {
      path: CANONICAL_ENGLISH_README_PATH,
      locale: 'en-us',
      role: 'canonical-en',
      exists: false,
      sha: '',
      content: '',
      originalContent: '',
      changed: false,
    });
  }

  const primary = mapped.get(PRIMARY_README_PATH)!;
  const canonical = mapped.get(CANONICAL_ENGLISH_README_PATH)!;
  const canonicalEnglishContent = canonical.content || primary.content;
  primary.content = canonicalEnglishContent;
  canonical.content = canonicalEnglishContent;

  const regionVariants = Array.from(mapped.values()).map((variant) => ({
    path: variant.path,
    locale: variant.locale,
    role: variant.role,
  }));

  for (const variant of mapped.values()) {
    variant.content = normalizeReadmeVariantContent(variant.content, regionVariants);
    variant.changed = !variant.exists || variant.content !== variant.originalContent;
  }

  return Array.from(mapped.values()).sort(compareReadmeWriteOrder);
}

export async function fetchReadmeWorkspace(token: string, owner: string, repo: string): Promise<ReadmeWorkspaceResult> {
  const rootEntries = await fetchRootContents(token, owner, repo);
  const readmePaths = collectManagedReadmePaths(rootEntries);
  const variants = await Promise.all(readmePaths.map(async (path) => {
    const metadata = resolveReadmeVariantMetadata(path);
    if (!metadata) {
      throw new GitHubApiError(`Unsupported README variant path: ${path}`, 'unknown');
    }

    const result = await fetchFileContent(token, owner, repo, path);
    return {
      path,
      locale: metadata.locale,
      role: metadata.role,
      exists: result.exists,
      content: result.content,
      sha: result.sha,
    } satisfies ReadmeVariant;
  }));

  return {
    variants: mirrorCanonicalEnglishVariants(variants).sort(compareReadmeVariantDisplayOrder),
  };
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

export async function fetchFileContent(token: string, owner: string, repo: string, path: string): Promise<FileContentResult> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const encodedPath = encodeRepoPath(path);

  try {
    const { data } = await requestJson<RawGitHubContentFile | RawGitHubContentFile[]>(
      `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}`,
      token,
    );

    if (Array.isArray(data) || data.type !== 'file') {
      throw new GitHubApiError(`Repository path ${path} is not a file.`, 'unknown');
    }

    if (data.encoding !== 'base64' || typeof data.content !== 'string' || typeof data.sha !== 'string') {
      throw new GitHubApiError(`Repository file ${path} could not be decoded.`, 'unknown');
    }

    return {
      content: Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8'),
      sha: data.sha,
      exists: true,
    };
  } catch (error) {
    if (error instanceof GitHubApiError && error.status === 404) {
      return {
        content: '',
        sha: '',
        exists: false,
      };
    }

    throw error;
  }
}

export async function commitFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  payload: CommitFilePayload,
): Promise<CommitFileResult> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const encodedPath = encodeRepoPath(path);
  const requestBody: Record<string, string> = {
    message: payload.message,
    content: Buffer.from(payload.content, 'utf8').toString('base64'),
    branch: payload.branch,
  };

  if (payload.sha && payload.sha.trim().length > 0) {
    requestBody.sha = payload.sha.trim();
  }

  let response: Response;

  try {
    response = await fetch(`${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/contents/${encodedPath}`, {
      method: 'PUT',
      headers: {
        ...buildHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    throw new GitHubApiError(
      error instanceof Error ? error.message : 'Network error while committing the repository file.',
      'network',
    );
  }

  await assertResponse(response);
  const data = await response.json() as RawGitHubCommitFileResponse;
  const newSha = data.content?.sha;

  if (!newSha) {
    throw new GitHubApiError(`GitHub did not return a blob SHA for ${path}.`, 'unknown');
  }

  return { newSha };
}

export async function submitReadmeWorkspace(
  token: string,
  owner: string,
  repo: string,
  payload: SubmitReadmeWorkspacePayload,
): Promise<ReadmeBatchSubmissionResult> {
  const preparedVariants = buildPreparedReadmeVariants(payload.variants);
  const files: ReadmeBatchSubmissionResult['files'] = preparedVariants.map((variant) => ({
    path: variant.path,
    locale: variant.locale,
    role: variant.role,
    attempted: false,
    status: 'skipped' as const,
    content: variant.content,
  }));
  const changedVariants = preparedVariants.filter((variant) => variant.changed);

  if (changedVariants.length === 0) {
    return {
      success: true,
      strategy: payload.strategy,
      files,
    };
  }

  const branchName = payload.strategy === 'pull_request'
    ? payload.branchName?.trim()
    : payload.defaultBranch.trim();

  if (!branchName) {
    throw new GitHubApiError('A target branch name is required for README submission.', 'unknown');
  }

  if (payload.strategy === 'pull_request') {
    await createRef(token, owner, repo, branchName, payload.defaultBranch);
  }

  for (const variant of changedVariants) {
    const resultIndex = files.findIndex((file) => file.path === variant.path);

    try {
      const commitResult = await commitFile(token, owner, repo, variant.path, {
        content: variant.content,
        message: payload.commitMessage,
        branch: branchName,
        sha: variant.sha,
      });

      files[resultIndex] = {
        ...files[resultIndex],
        attempted: true,
        status: 'written',
        newSha: commitResult.newSha,
      };
    } catch (error) {
      files[resultIndex] = {
        ...files[resultIndex],
        attempted: true,
        status: 'failed',
        error: summarizeError(error),
        conflict: error instanceof GitHubApiError && error.status === 409,
      };

      return {
        success: false,
        strategy: payload.strategy,
        branchName,
        files,
        failedPath: variant.path,
        error: summarizeError(error),
      };
    }
  }

  if (payload.strategy === 'pull_request') {
    try {
      const pullRequest = await createPullRequest(
        token,
        owner,
        repo,
        payload.pullRequestTitle?.trim() || payload.commitMessage,
        branchName,
        payload.defaultBranch,
      );

      return {
        success: true,
        strategy: payload.strategy,
        branchName,
        files,
        pullRequest,
      };
    } catch (error) {
      return {
        success: false,
        strategy: payload.strategy,
        branchName,
        files,
        error: summarizeError(error),
      };
    }
  }

  return {
    success: true,
    strategy: payload.strategy,
    branchName,
    files,
  };
}

export async function createRef(token: string, owner: string, repo: string, ref: string, sha: string): Promise<void> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const resolvedSha = /^[0-9a-f]{40}$/iu.test(sha)
    ? sha
    : (await requestJson<RawGitHubRefResponse>(
      `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/git/ref/heads/${encodeURIComponent(sha)}`,
      token,
    )).data.object?.sha;

  if (!resolvedSha) {
    throw new GitHubApiError(`GitHub did not return a commit SHA for base reference ${sha}.`, 'unknown');
  }

  await requestJson<RawGitHubRefResponse>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/git/refs`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${ref}`,
        sha: resolvedSha,
      }),
    },
  );
}

export async function createPullRequest(
  token: string,
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
): Promise<PullRequestResult> {
  const encodedOwner = encodeURIComponent(owner);
  const encodedRepo = encodeURIComponent(repo);
  const { data } = await requestJson<RawGitHubPullRequest>(
    `${GITHUB_API_ROOT}/repos/${encodedOwner}/${encodedRepo}/pulls`,
    token,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        head,
        base,
      }),
    },
  );

  return {
    url: data.url,
    number: data.number,
    htmlUrl: data.html_url,
  };
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

export async function createGitHubRepo(token: string, payload: CreateGitHubRepoPayload): Promise<CreateGitHubRepoResult> {
  const name = payload.name.trim();
  const ownerLogin = payload.owner.login.trim();

  if (name.length === 0) {
    return buildCreateGitHubRepoFailure('validation', 'Repository name is required.');
  }

  if (ownerLogin.length === 0) {
    return buildCreateGitHubRepoFailure('validation', 'Repository owner is required.');
  }

  const gitignoreTemplate = normalizeOptionalString(payload.gitignoreTemplate);
  const licenseTemplate = normalizeOptionalString(payload.licenseTemplate);
  const requestBody = {
    name,
    description: normalizeOptionalString(payload.description),
    private: payload.visibility === 'private',
    auto_init: payload.initializeWithReadme || Boolean(gitignoreTemplate) || Boolean(licenseTemplate),
    gitignore_template: gitignoreTemplate,
    license_template: licenseTemplate,
  };
  const endpoint = payload.owner.type === 'organization'
    ? `${GITHUB_API_ROOT}/orgs/${encodeURIComponent(ownerLogin)}/repos`
    : `${GITHUB_API_ROOT}/user/repos`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...buildHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    return buildCreateGitHubRepoFailure(
      'network',
      error instanceof Error ? error.message : 'Network error while contacting GitHub.',
    );
  }

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    return mapCreateGitHubRepoFailure(response, detail, payload);
  }

  const data = await response.json() as RawGitHubRepo;
  return {
    success: true,
    repo: mapRepo(data),
  };
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
