import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type { GitHubOrg, GitHubRepo } from '../../../shared/api';

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface GitHubRepoGroup {
  org: GitHubOrg;
  repos: GitHubRepo[];
}

interface FetchReposPayload {
  accountId: string;
  orgs: GitHubOrg[];
  repos: GitHubRepo[];
  orgError: string | null;
}

export interface GitHubReposState {
  orgs: GitHubOrg[];
  repos: GitHubRepo[];
  groupedRepos: GitHubRepoGroup[];
  personalRepos: GitHubRepo[];
  activeAccountId: string | null;
  fetchStatus: FetchStatus;
  error: string | null;
}

const initialState: GitHubReposState = {
  orgs: [],
  repos: [],
  groupedRepos: [],
  personalRepos: [],
  activeAccountId: null,
  fetchStatus: 'idle',
  error: null,
};

function toMessage(error: unknown, fallbackKey: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return i18n.t(fallbackKey, { ns: 'github' });
}

function sortRepos(repos: GitHubRepo[]): GitHubRepo[] {
  return [...repos].sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

function buildGroups(orgs: GitHubOrg[], repos: GitHubRepo[]): Pick<GitHubReposState, 'groupedRepos' | 'personalRepos'> {
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

  const groupedRepos = orgs
    .slice()
    .sort((left, right) => left.login.localeCompare(right.login))
    .map((org) => ({
      org,
      repos: sortRepos(grouped.get(org.login) ?? []),
    }))
    .filter((group) => group.repos.length > 0);

  return {
    groupedRepos,
    personalRepos: sortRepos(personalRepos),
  };
}

export const fetchRepos = createAsyncThunk<FetchReposPayload, string, { rejectValue: string }>(
  'githubRepos/fetchRepos',
  async (accountId, { rejectWithValue }) => {
    const [orgsResult, reposResult] = await Promise.allSettled([
      window.hagihub.fetchGitHubOrgs(accountId),
      window.hagihub.fetchGitHubRepos(accountId),
    ]);

    if (reposResult.status === 'rejected') {
      return rejectWithValue(toMessage(reposResult.reason, 'errors.fetchReposFailed'));
    }

    return {
      accountId,
      orgs: orgsResult.status === 'fulfilled' ? orgsResult.value.orgs : [],
      repos: reposResult.value.repos,
      orgError: orgsResult.status === 'rejected'
        ? toMessage(orgsResult.reason, 'errors.orgsPartialFailed')
        : null,
    };
  },
);

const githubReposSlice = createSlice({
  name: 'githubRepos',
  initialState,
  reducers: {
    clearRepos(state) {
      state.orgs = [];
      state.repos = [];
      state.groupedRepos = [];
      state.personalRepos = [];
      state.activeAccountId = null;
      state.fetchStatus = 'idle';
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRepos.pending, (state, action) => {
        state.orgs = [];
        state.repos = [];
        state.groupedRepos = [];
        state.personalRepos = [];
        state.activeAccountId = action.meta.arg;
        state.fetchStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchRepos.fulfilled, (state, action) => {
        const { groupedRepos, personalRepos } = buildGroups(action.payload.orgs, action.payload.repos);
        state.orgs = action.payload.orgs;
        state.repos = action.payload.repos;
        state.groupedRepos = groupedRepos;
        state.personalRepos = personalRepos;
        state.activeAccountId = action.payload.accountId;
        state.fetchStatus = 'succeeded';
        state.error = action.payload.orgError;
      })
      .addCase(fetchRepos.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.error = action.payload ?? i18n.t('errors.fetchReposFailed', { ns: 'github' });
      });
  },
});

export const { clearRepos } = githubReposSlice.actions;

export default githubReposSlice.reducer;
