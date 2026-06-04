import type { GitHubOrg, GitHubRepo, GitHubUser } from '../shared/api.js';

const GITHUB_API_ROOT = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const GITHUB_USER_AGENT = 'Hagihub';

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
  try {
    const payload = await response.json() as { message?: string };
    return typeof payload.message === 'string' && payload.message.trim().length > 0 ? payload.message : null;
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

async function requestJson<T>(url: string, token: string): Promise<{ data: T; response: Response }> {
  let response: Response;

  try {
    response = await fetch(url, {
      headers: buildHeaders(token),
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
