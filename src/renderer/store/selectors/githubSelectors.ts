import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { GitHubOrg, GitHubRepo } from '../../../shared/api';
import type { GitHubRepoGroup } from '@/store/slices/githubReposSlice';

function sortRepos(repos: GitHubRepo[]): GitHubRepo[] {
  return [...repos].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function matchesRepoSearch(repo: GitHubRepo, searchQuery: string): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return repo.name.toLowerCase().includes(normalizedQuery)
    || repo.fullName.toLowerCase().includes(normalizedQuery)
    || (repo.description?.toLowerCase().includes(normalizedQuery) ?? false);
}

function buildRepoCollections(orgs: GitHubOrg[], repos: GitHubRepo[]): {
  groupedRepos: GitHubRepoGroup[];
  personalRepos: GitHubRepo[];
} {
  const orgMap = new Map(orgs.map((org) => [org.login, org]));
  const grouped = new Map<string, GitHubRepo[]>();
  const personalRepos: GitHubRepo[] = [];

  for (const repo of repos) {
    const org = orgMap.get(repo.owner.login);

    if (!org) {
      personalRepos.push(repo);
      continue;
    }

    const group = grouped.get(org.login) ?? [];
    group.push(repo);
    grouped.set(org.login, group);
  }

  return {
    groupedRepos: orgs
      .slice()
      .sort((left, right) => left.login.localeCompare(right.login))
      .map((org) => ({
        org,
        repos: sortRepos(grouped.get(org.login) ?? []),
      }))
      .filter((group) => group.repos.length > 0),
    personalRepos: sortRepos(personalRepos),
  };
}

export const selectGitHubAccountsState = (state: RootState) => state.githubAccounts;
export const selectGitHubReposState = (state: RootState) => state.githubRepos;

export const selectActiveGitHubAccount = createSelector(
  [selectGitHubAccountsState],
  (githubAccounts) => githubAccounts.accounts.find((account) => account.id === githubAccounts.activeAccountId) ?? null,
);

export const selectGitHubRepoCollections = createSelector(
  [
    (state: RootState) => state.githubRepos.orgs,
    (state: RootState) => state.githubRepos.repos,
  ],
  (orgs, repos) => buildRepoCollections(orgs, repos),
);

export const selectGitHubRepoOwnerCounts = createSelector(
  [selectGitHubReposState, selectGitHubRepoCollections],
  (githubRepos, collections) => ({
    totalRepoCount: githubRepos.repos.length,
    personalRepoCount: collections.personalRepos.length,
    orgRepoCounts: Object.fromEntries(
      collections.groupedRepos.map((group) => [group.org.login, group.repos.length]),
    ),
  }),
);

export const selectFilteredGitHubRepos = createSelector(
  [selectGitHubReposState, selectGitHubRepoCollections],
  (githubRepos, collections) => {
    const { activeOrgFilter, searchQuery, visibilityFilter } = githubRepos;

    let groupedRepos = activeOrgFilter === 'all'
      ? collections.groupedRepos
      : activeOrgFilter === 'personal'
        ? []
        : collections.groupedRepos.filter((group) => group.org.login === activeOrgFilter);

    let personalRepos = activeOrgFilter === 'all'
      ? collections.personalRepos
      : activeOrgFilter === 'personal'
        ? collections.personalRepos
        : [];

    if (visibilityFilter !== 'all') {
      const isPrivate = visibilityFilter === 'private';
      groupedRepos = groupedRepos
        .map((group) => ({
          ...group,
          repos: group.repos.filter((repo) => repo.isPrivate === isPrivate),
        }))
        .filter((group) => group.repos.length > 0);
      personalRepos = personalRepos.filter((repo) => repo.isPrivate === isPrivate);
    }

    if (searchQuery.trim().length > 0) {
      groupedRepos = groupedRepos
        .map((group) => ({
          ...group,
          repos: group.repos.filter((repo) => matchesRepoSearch(repo, searchQuery)),
        }))
        .filter((group) => group.repos.length > 0);
      personalRepos = personalRepos.filter((repo) => matchesRepoSearch(repo, searchQuery));
    }

    const filteredRepoCount = groupedRepos.reduce((count, group) => count + group.repos.length, 0) + personalRepos.length;

    return {
      groupedRepos,
      personalRepos,
      filteredRepoCount,
      showFilteredEmpty: githubRepos.repos.length > 0 && filteredRepoCount === 0,
    };
  },
);
