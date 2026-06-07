import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GitHubRepo } from '../../shared/api.js';
import {
  findDuplicateRepo,
  isDuplicateRepo,
  resolveSpecialRepoName,
} from '../../shared/github-special-repos.js';

const repos: GitHubRepo[] = [
  {
    id: 1,
    name: '.github',
    fullName: 'octocat/.github',
    description: null,
    htmlUrl: 'https://github.com/octocat/.github',
    isPrivate: false,
    isFork: false,
    updatedAt: '2026-06-07T10:00:00.000Z',
    owner: {
      login: 'octocat',
      avatarUrl: 'https://avatars.example.com/octocat',
      type: 'User',
    },
  },
  {
    id: 2,
    name: 'octocat.github.io',
    fullName: 'octocat/octocat.github.io',
    description: null,
    htmlUrl: 'https://github.com/octocat/octocat.github.io',
    isPrivate: false,
    isFork: false,
    updatedAt: '2026-06-07T10:00:00.000Z',
    owner: {
      login: 'octocat',
      avatarUrl: 'https://avatars.example.com/octocat',
      type: 'User',
    },
  },
  {
    id: 3,
    name: 'octocat',
    fullName: 'team-octocat/octocat',
    description: null,
    htmlUrl: 'https://github.com/team-octocat/octocat',
    isPrivate: true,
    isFork: false,
    updatedAt: '2026-06-07T10:00:00.000Z',
    owner: {
      login: 'team-octocat',
      avatarUrl: 'https://avatars.example.com/team-octocat',
      type: 'Organization',
    },
  },
];

describe('isDuplicateRepo', () => {
  it('matches exact owner and repository names', () => {
    assert.equal(isDuplicateRepo(repos, 'octocat', '.github'), true);
  });

  it('treats owner and repository names case-insensitively', () => {
    assert.equal(isDuplicateRepo(repos, 'OCTOCAT', 'OCTOCAT.GITHUB.IO'), true);
  });

  it('requires the owner to match as well as the repository name', () => {
    assert.equal(isDuplicateRepo(repos, 'octocat', 'octocat'), false);
    assert.equal(isDuplicateRepo(repos, 'team-octocat', 'octocat'), true);
  });

  it('returns the matching repository when requested directly', () => {
    const duplicateRepo = findDuplicateRepo(repos, 'TEAM-OCTOCAT', 'OCTOCAT');

    assert.equal(duplicateRepo?.fullName, 'team-octocat/octocat');
  });
});

describe('resolveSpecialRepoName', () => {
  it('always resolves the shared .github repository name', () => {
    assert.equal(resolveSpecialRepoName('github', 'octocat'), '.github');
  });

  it('resolves the GitHub Pages repository name for a personal owner', () => {
    assert.equal(resolveSpecialRepoName('github-pages', 'octocat'), 'octocat.github.io');
  });

  it('resolves the GitHub Pages repository name for an organization owner', () => {
    assert.equal(resolveSpecialRepoName('github-pages', 'hagicode'), 'hagicode.github.io');
  });

  it('resolves the username repository to the owner login', () => {
    assert.equal(resolveSpecialRepoName('username', 'octocat'), 'octocat');
  });
});
