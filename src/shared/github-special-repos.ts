import type { CreateGitHubRepoPayload, GitHubRepo } from './api.js';

export type SpecialRepoPatternId = 'github' | 'github-pages' | 'username';

export interface SpecialRepoPattern {
  id: SpecialRepoPatternId;
  isPersonalOnly?: boolean;
  resolveName: (ownerLogin: string) => string;
}

function normalizeRepoIdentity(value: string): string {
  return value.trim().toLowerCase();
}

function findPattern(patternId: SpecialRepoPatternId): SpecialRepoPattern {
  const pattern = SPECIAL_REPO_PATTERNS.find((candidate) => candidate.id === patternId);

  if (!pattern) {
    throw new Error(`Unknown special repository pattern: ${patternId}`);
  }

  return pattern;
}

// These patterns drive the quick-select UI. Add new entries here to extend support.
export const SPECIAL_REPO_PATTERNS: readonly SpecialRepoPattern[] = [
  {
    id: 'github',
    resolveName: () => '.github',
  },
  {
    id: 'github-pages',
    // Examples: octocat.github.io, hagicode.github.io
    resolveName: (ownerLogin) => `${ownerLogin}.github.io`,
  },
  {
    id: 'username',
    isPersonalOnly: true,
    // Personal profile repositories mirror the account login exactly.
    resolveName: (ownerLogin) => ownerLogin,
  },
] as const;

export function canUseSpecialRepoPattern(
  pattern: Pick<SpecialRepoPattern, 'isPersonalOnly'>,
  ownerType: CreateGitHubRepoPayload['owner']['type'],
): boolean {
  return !pattern.isPersonalOnly || ownerType === 'personal';
}

// Owner-aware patterns re-resolve whenever the selected owner changes.
export function resolveSpecialRepoName(patternId: SpecialRepoPatternId, ownerLogin: string): string {
  return findPattern(patternId).resolveName(ownerLogin.trim());
}

export function buildGitHubRepoUrl(ownerLogin: string, repoName: string): string {
  return `https://github.com/${encodeURIComponent(ownerLogin.trim())}/${encodeURIComponent(repoName.trim())}`;
}

export function findDuplicateRepo(repos: GitHubRepo[], ownerLogin: string, repoName: string): GitHubRepo | null {
  const normalizedOwnerLogin = normalizeRepoIdentity(ownerLogin);
  const normalizedRepoName = normalizeRepoIdentity(repoName);

  if (normalizedOwnerLogin.length === 0 || normalizedRepoName.length === 0) {
    return null;
  }

  return repos.find((repo) => (
    normalizeRepoIdentity(repo.owner.login) === normalizedOwnerLogin
    && normalizeRepoIdentity(repo.name) === normalizedRepoName
  )) ?? null;
}

/**
 * Checks duplicates the same way GitHub names repositories: case-insensitive within one owner.
 */
export function isDuplicateRepo(repos: GitHubRepo[], ownerLogin: string, repoName: string): boolean {
  return findDuplicateRepo(repos, ownerLogin, repoName) !== null;
}
