import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type {
  CreateGitHubRepoFailure,
  CreateGitHubRepoPayload,
  CreateGitHubRepoResult,
  GitHubOrg,
  GitHubRepo,
} from '../../../shared/api';
import { isDuplicateRepo as checkIsDuplicateRepo } from '../../../shared/github-special-repos';

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

interface FetchReposArgs {
  accountId: string;
  forceRefresh?: boolean;
}

interface CreateRepoArgs {
  accountId: string;
  payload: CreateGitHubRepoPayload;
}

interface CreateRepoSuccessPayload {
  createdRepo: GitHubRepo;
  refreshedRepos: FetchReposPayload | null;
  refreshError: string | null;
}

type CreateRepoFailure = Extract<CreateGitHubRepoResult, { success: false }>;

export type OrgFilterValue = 'all' | 'personal' | string;
export type VisibilityFilter = 'all' | 'public' | 'private';

export interface GitHubReposState {
  orgs: GitHubOrg[];
  repos: GitHubRepo[];
  activeAccountId: string | null;
  activeOrgFilter: OrgFilterValue;
  searchQuery: string;
  visibilityFilter: VisibilityFilter;
  fetchStatus: FetchStatus;
  error: string | null;
  createStatus: FetchStatus;
  createError: CreateRepoFailure | null;
  lastCreatedRepoFullName: string | null;
  lastCreateRefreshError: string | null;
}

const initialState: GitHubReposState = {
  orgs: [],
  repos: [],
  activeAccountId: null,
  activeOrgFilter: 'all',
  searchQuery: '',
  visibilityFilter: 'all',
  fetchStatus: 'idle',
  error: null,
  createStatus: 'idle',
  createError: null,
  lastCreatedRepoFullName: null,
  lastCreateRefreshError: null,
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

async function loadReposPayload(accountId: string, forceRefresh = false): Promise<FetchReposPayload> {
  if (forceRefresh) {
    await window.hagihub.invalidateGitHubCache();
  }

  const [orgsResult, reposResult] = await Promise.allSettled([
    window.hagihub.fetchGitHubOrgs(accountId),
    window.hagihub.fetchGitHubRepos(accountId),
  ]);

  if (reposResult.status === 'rejected') {
    throw new Error(toMessage(reposResult.reason, 'errors.fetchReposFailed'));
  }

  return {
    accountId,
    orgs: orgsResult.status === 'fulfilled' ? orgsResult.value.orgs : [],
    repos: reposResult.value.repos,
    orgError: orgsResult.status === 'rejected'
      ? toMessage(orgsResult.reason, 'errors.orgsPartialFailed')
      : null,
  };
}

function localizeCreateRepoFailure(
  result: CreateRepoFailure,
): CreateRepoFailure {
  if (result.errorCode === 'duplicate') {
    return result;
  }

  if (result.errorCode === 'validation') {
    return {
      ...result,
      errorMessage: result.errorMessage.trim().length > 0
        ? result.errorMessage
        : i18n.t('createDialog.errors.validation', { ns: 'github' }),
    };
  }

  if (result.errorCode === 'permission_denied') {
    return {
      ...result,
      errorMessage: i18n.t('createDialog.errors.permissionDenied', { ns: 'github' }),
    };
  }

  if (result.errorCode === 'rate_limited') {
    return {
      ...result,
      errorMessage: i18n.t('createDialog.errors.rateLimited', { ns: 'github' }),
    };
  }

  if (result.errorCode === 'network') {
    return {
      ...result,
      errorMessage: i18n.t('createDialog.errors.network', { ns: 'github' }),
    };
  }

  if (result.errorCode === 'unauthorized') {
    return {
      ...result,
      errorMessage: i18n.t('createDialog.errors.unauthorized', { ns: 'github' }),
    };
  }

  return {
    ...result,
    errorMessage: result.errorMessage.trim().length > 0
      ? result.errorMessage
      : i18n.t('createDialog.errors.unknown', { ns: 'github' }),
  };
}

export function isDuplicateRepo(repos: GitHubRepo[], ownerLogin: string, repoName: string): boolean {
  return checkIsDuplicateRepo(repos, ownerLogin, repoName);
}

function repoMatchesSearch(repo: GitHubRepo, searchQuery: string): boolean {
  const query = searchQuery.trim().toLowerCase();

  if (query.length === 0) {
    return true;
  }

  return repo.name.toLowerCase().includes(query)
    || repo.fullName.toLowerCase().includes(query)
    || (repo.description?.toLowerCase().includes(query) ?? false);
}

function repoMatchesVisibility(repo: GitHubRepo, visibilityFilter: VisibilityFilter): boolean {
  if (visibilityFilter === 'all') {
    return true;
  }

  return repo.isPrivate === (visibilityFilter === 'private');
}

function repoMatchesOwner(repo: GitHubRepo, activeOrgFilter: OrgFilterValue): boolean {
  if (activeOrgFilter === 'all') {
    return true;
  }

  if (activeOrgFilter === 'personal') {
    return repo.owner.type !== 'Organization';
  }

  return repo.owner.login === activeOrgFilter;
}

function ensureCreatedRepoVisible(state: GitHubReposState, repo: GitHubRepo): void {
  if (
    repoMatchesSearch(repo, state.searchQuery)
    && repoMatchesVisibility(repo, state.visibilityFilter)
    && repoMatchesOwner(repo, state.activeOrgFilter)
  ) {
    return;
  }

  state.searchQuery = '';
  state.visibilityFilter = repo.isPrivate ? 'private' : 'public';
  state.activeOrgFilter = repo.owner.type === 'Organization' ? repo.owner.login : 'personal';
}

function applyFetchedRepos(state: GitHubReposState, payload: FetchReposPayload): void {
  state.orgs = payload.orgs;
  state.repos = payload.repos;
  state.activeAccountId = payload.accountId;
  state.fetchStatus = 'succeeded';
  state.error = payload.orgError;
}

export const fetchRepos = createAsyncThunk<FetchReposPayload, FetchReposArgs, { rejectValue: string }>(
  'githubRepos/fetchRepos',
  async ({ accountId, forceRefresh = false }, { rejectWithValue }) => {
    try {
      return await loadReposPayload(accountId, forceRefresh);
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.fetchReposFailed'));
    }
  },
);

export const createRepo = createAsyncThunk<CreateRepoSuccessPayload, CreateRepoArgs, { rejectValue: CreateRepoFailure }>(
  'githubRepos/createRepo',
  async ({ accountId, payload }, { rejectWithValue }) => {
    const result = await window.hagihub.createGitHubRepo(accountId, payload);

    if (!result.success) {
      return rejectWithValue(localizeCreateRepoFailure(result));
    }

    try {
      const refreshedRepos = await loadReposPayload(accountId, true);

      return {
        createdRepo: result.repo,
        refreshedRepos,
        refreshError: null,
      };
    } catch {
      return {
        createdRepo: result.repo,
        refreshedRepos: null,
        refreshError: i18n.t('createDialog.refreshFailed', { ns: 'github' }),
      };
    }
  },
);

const githubReposSlice = createSlice({
  name: 'githubRepos',
  initialState,
  reducers: {
    clearRepos(state) {
      state.orgs = [];
      state.repos = [];
      state.activeAccountId = null;
      state.activeOrgFilter = 'all';
      state.searchQuery = '';
      state.visibilityFilter = 'all';
      state.fetchStatus = 'idle';
      state.error = null;
      state.createStatus = 'idle';
      state.createError = null;
      state.lastCreatedRepoFullName = null;
      state.lastCreateRefreshError = null;
    },
    setActiveOrgFilter(state, action: PayloadAction<OrgFilterValue>) {
      state.activeOrgFilter = action.payload;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    setVisibilityFilter(state, action: PayloadAction<VisibilityFilter>) {
      state.visibilityFilter = action.payload;
    },
    resetCreateDialogState(state) {
      state.createStatus = 'idle';
      state.createError = null;
    },
    dismissCreateFeedback(state) {
      state.lastCreatedRepoFullName = null;
      state.lastCreateRefreshError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRepos.pending, (state, action) => {
        state.orgs = [];
        state.repos = [];
        state.activeAccountId = action.meta.arg.accountId;
        state.activeOrgFilter = 'all';
        state.searchQuery = '';
        state.visibilityFilter = 'all';
        state.fetchStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchRepos.fulfilled, (state, action) => {
        applyFetchedRepos(state, action.payload);
        state.activeOrgFilter = 'personal';
      })
      .addCase(fetchRepos.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.error = action.payload ?? i18n.t('errors.fetchReposFailed', { ns: 'github' });
      })
      .addCase(createRepo.pending, (state) => {
        state.createStatus = 'loading';
        state.createError = null;
        state.lastCreatedRepoFullName = null;
        state.lastCreateRefreshError = null;
      })
      .addCase(createRepo.fulfilled, (state, action) => {
        if (action.payload.refreshedRepos) {
          applyFetchedRepos(state, action.payload.refreshedRepos);
          ensureCreatedRepoVisible(state, action.payload.createdRepo);
        }

        state.createStatus = 'succeeded';
        state.createError = null;
        state.lastCreatedRepoFullName = action.payload.createdRepo.fullName;
        state.lastCreateRefreshError = action.payload.refreshError;
      })
      .addCase(createRepo.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.createError = action.payload ?? {
          success: false,
          errorCode: 'unknown',
          errorMessage: i18n.t('createDialog.errors.unknown', { ns: 'github' }),
        } satisfies CreateGitHubRepoFailure;
      });
  },
});

export const {
  clearRepos,
  dismissCreateFeedback,
  resetCreateDialogState,
  setActiveOrgFilter,
  setSearchQuery,
  setVisibilityFilter,
} = githubReposSlice.actions;

export default githubReposSlice.reducer;
