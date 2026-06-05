import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type {
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  GitHubAccountSummary,
  GitHubAccountsResult,
} from '../../../shared/api';

type LoadStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
type DeviceFlowStatus = 'idle' | 'requesting' | 'polling' | 'success' | 'error';

const MIGRATION_NOTICE_KEY = 'hagihub.accounts.migrationNoticeDismissed';

function isMigrationNoticeDismissed(): boolean {
  try {
    return window.localStorage.getItem(MIGRATION_NOTICE_KEY) === 'true';
  } catch {
    return false;
  }
}

export interface GitHubAccountsState {
  accounts: GitHubAccountSummary[];
  activeAccountId: string | null;
  fetchStatus: LoadStatus;
  deviceFlowStatus: DeviceFlowStatus;
  userCode: string | null;
  verificationUri: string | null;
  currentFlowId: string | null;
  expiresIn: number | null;
  interval: number | null;
  latestAccount: GitHubAccountSummary | null;
  error: string | null;
  notice: string | null;
  migrationNoticeDismissed: boolean;
}

const initialState: GitHubAccountsState = {
  accounts: [],
  activeAccountId: null,
  fetchStatus: 'idle',
  deviceFlowStatus: 'idle',
  userCode: null,
  verificationUri: null,
  currentFlowId: null,
  expiresIn: null,
  interval: null,
  latestAccount: null,
  error: null,
  notice: null,
  migrationNoticeDismissed: isMigrationNoticeDismissed(),
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

function upsertAccount(accounts: GitHubAccountSummary[], nextAccount: GitHubAccountSummary): GitHubAccountSummary[] {
  const remaining = accounts.filter((account) => account.id !== nextAccount.id);
  return [nextAccount, ...remaining];
}

function applyAccountsResult(state: GitHubAccountsState, payload: GitHubAccountsResult): void {
  state.accounts = payload.accounts;
  state.activeAccountId = payload.activeAccountId;
}

export const fetchAccounts = createAsyncThunk<GitHubAccountsResult, void, { rejectValue: string }>(
  'githubAccounts/fetchAccounts',
  async (_, { rejectWithValue }) => {
    try {
      return await window.hagihub.getGitHubAccounts();
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.loadAccountsFailed'));
    }
  },
);

export const startDeviceFlow = createAsyncThunk<DeviceFlowStartResult, void, { rejectValue: string }>(
  'githubAccounts/startDeviceFlow',
  async (_, { rejectWithValue }) => {
    try {
      return await window.hagihub.startDeviceFlow();
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.startDeviceFlowFailed'));
    }
  },
);

export const cancelDeviceFlow = createAsyncThunk<DeviceFlowPollResult, void, { rejectValue: string }>(
  'githubAccounts/cancelDeviceFlow',
  async (_, { rejectWithValue }) => {
    try {
      return await window.hagihub.cancelDeviceFlow();
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.cancelDeviceFlowFailed'));
    }
  },
);

export const removeAccount = createAsyncThunk<GitHubAccountsResult, string, { rejectValue: string }>(
  'githubAccounts/removeAccount',
  async (accountId, { rejectWithValue }) => {
    try {
      return await window.hagihub.removeGitHubAccount(accountId);
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.removeAccountFailed'));
    }
  },
);

export const switchAccount = createAsyncThunk<GitHubAccountsResult, string, { rejectValue: string }>(
  'githubAccounts/switchAccount',
  async (accountId, { rejectWithValue }) => {
    try {
      return await window.hagihub.switchGitHubAccount(accountId);
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.switchAccountFailed'));
    }
  },
);

const githubAccountsSlice = createSlice({
  name: 'githubAccounts',
  initialState,
  reducers: {
    applyDeviceFlowUpdate(state, action: PayloadAction<DeviceFlowPollResult>) {
      const payload = action.payload;
      state.currentFlowId = payload.flowId || state.currentFlowId;

      if (payload.status === 'success' && payload.account) {
        state.deviceFlowStatus = 'success';
        state.latestAccount = payload.account;
        state.error = null;
        state.accounts = upsertAccount(state.accounts, payload.account);
        state.activeAccountId = payload.account.id;
        return;
      }

      if (payload.status === 'cancelled') {
        state.deviceFlowStatus = 'idle';
        state.userCode = null;
        state.verificationUri = null;
        state.currentFlowId = null;
        state.expiresIn = null;
        state.interval = null;
        state.latestAccount = null;
        state.error = null;
        return;
      }

      if (payload.status === 'expired' || payload.status === 'error') {
        state.deviceFlowStatus = 'error';
        state.error = payload.error ?? i18n.t('errors.deviceFlowFailed', { ns: 'github' });
      }
    },
    resetDeviceFlowState(state) {
      state.deviceFlowStatus = 'idle';
      state.userCode = null;
      state.verificationUri = null;
      state.currentFlowId = null;
      state.expiresIn = null;
      state.interval = null;
      state.latestAccount = null;
      state.error = null;
    },
    clearAccountsNotice(state) {
      state.notice = null;
    },
    clearMigrationNotice(state) {
      state.migrationNoticeDismissed = true;
      try {
        window.localStorage.setItem(MIGRATION_NOTICE_KEY, 'true');
      } catch {}
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAccounts.pending, (state) => {
        state.fetchStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.fetchStatus = 'succeeded';
        applyAccountsResult(state, action.payload);
        state.notice = action.payload.recoveredCorruptedStorage
          ? i18n.t('errors.storageReset', { ns: 'github' })
          : null;
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.fetchStatus = 'failed';
        state.error = action.payload ?? i18n.t('errors.loadAccountsFailed', { ns: 'github' });
      })
      .addCase(startDeviceFlow.pending, (state) => {
        state.deviceFlowStatus = 'requesting';
        state.userCode = null;
        state.verificationUri = null;
        state.currentFlowId = null;
        state.expiresIn = null;
        state.interval = null;
        state.latestAccount = null;
        state.error = null;
      })
      .addCase(startDeviceFlow.fulfilled, (state, action) => {
        state.deviceFlowStatus = 'polling';
        state.currentFlowId = action.payload.flowId;
        state.userCode = action.payload.userCode;
        state.verificationUri = action.payload.verificationUri;
        state.expiresIn = action.payload.expiresIn;
        state.interval = action.payload.interval;
      })
      .addCase(startDeviceFlow.rejected, (state, action) => {
        state.deviceFlowStatus = 'error';
        state.error = action.payload ?? i18n.t('errors.startDeviceFlowFailed', { ns: 'github' });
      })
      .addCase(cancelDeviceFlow.fulfilled, (state) => {
        state.deviceFlowStatus = 'idle';
        state.userCode = null;
        state.verificationUri = null;
        state.currentFlowId = null;
        state.expiresIn = null;
        state.interval = null;
        state.latestAccount = null;
        state.error = null;
      })
      .addCase(cancelDeviceFlow.rejected, (state, action) => {
        state.deviceFlowStatus = 'error';
        state.error = action.payload ?? i18n.t('errors.cancelDeviceFlowFailed', { ns: 'github' });
      })
      .addCase(removeAccount.fulfilled, (state, action) => {
        applyAccountsResult(state, action.payload);
        state.error = null;
      })
      .addCase(removeAccount.rejected, (state, action) => {
        state.error = action.payload ?? i18n.t('errors.removeAccountFailed', { ns: 'github' });
      })
      .addCase(switchAccount.fulfilled, (state, action) => {
        applyAccountsResult(state, action.payload);
        state.error = null;
      })
      .addCase(switchAccount.rejected, (state, action) => {
        state.error = action.payload ?? i18n.t('errors.switchAccountFailed', { ns: 'github' });
      });
  },
});

export const { applyDeviceFlowUpdate, clearAccountsNotice, clearMigrationNotice, resetDeviceFlowState } = githubAccountsSlice.actions;

export default githubAccountsSlice.reducer;
