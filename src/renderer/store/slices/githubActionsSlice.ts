import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type { GitHubActionsResult, GitHubRepoActionsSummary } from '../../../shared/api';

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface FetchActionsArgs {
  accountId: string;
  repoFullNames: string[];
  forceRefresh?: boolean;
}

export interface GitHubActionsState {
  summariesByRepoFullName: Partial<Record<string, GitHubRepoActionsSummary>>;
  orderedRepoFullNames: string[];
  activeAccountId: string | null;
  fetchStatus: FetchStatus;
  failedCount: number;
  error: string | null;
}

const initialState: GitHubActionsState = {
  summariesByRepoFullName: {},
  orderedRepoFullNames: [],
  activeAccountId: null,
  fetchStatus: 'idle',
  failedCount: 0,
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

function toMap(summaries: GitHubRepoActionsSummary[]): Partial<Record<string, GitHubRepoActionsSummary>> {
  return Object.fromEntries(summaries.map((summary) => [summary.repoFullName, summary]));
}

export const fetchActionsSummaries = createAsyncThunk<
  { accountId: string; result: GitHubActionsResult },
  FetchActionsArgs,
  { rejectValue: string }
>(
  'githubActions/fetchActionsSummaries',
  async ({ accountId, repoFullNames, forceRefresh = false }, { rejectWithValue }) => {
    try {
      if (forceRefresh) {
        await window.hagihub.invalidateGitHubCache();
      }

      const result = await window.hagihub.fetchGitHubActions(accountId, repoFullNames);
      return { accountId, result };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.fetchActionsFailed'));
    }
  },
);

const githubActionsSlice = createSlice({
  name: 'githubActions',
  initialState,
  reducers: {
    clearActions(state) {
      state.summariesByRepoFullName = {};
      state.orderedRepoFullNames = [];
      state.activeAccountId = null;
      state.fetchStatus = 'idle';
      state.failedCount = 0;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchActionsSummaries.pending, (state, action) => {
        state.summariesByRepoFullName = {};
        state.orderedRepoFullNames = action.meta.arg.repoFullNames;
        state.activeAccountId = action.meta.arg.accountId;
        state.fetchStatus = 'loading';
        state.failedCount = 0;
        state.error = null;
      })
      .addCase(fetchActionsSummaries.fulfilled, (state, action) => {
        state.summariesByRepoFullName = toMap(action.payload.result.summaries);
        state.orderedRepoFullNames = action.payload.result.summaries.map((summary) => summary.repoFullName);
        state.activeAccountId = action.payload.accountId;
        state.fetchStatus = 'succeeded';
        state.failedCount = action.payload.result.failedCount;
        state.error = null;
      })
      .addCase(fetchActionsSummaries.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.failedCount = 0;
        state.error = action.payload ?? i18n.t('errors.fetchActionsFailed', { ns: 'github' });
      });
  },
});

export const { clearActions } = githubActionsSlice.actions;

export default githubActionsSlice.reducer;
