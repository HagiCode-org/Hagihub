import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type { RootState } from '@/store';
import type {
  GitHubManagedWorkflow,
  GitHubManagedWorkflowReference,
  GitHubWorkflowDispatchResponse,
  GitHubWorkflowSummary,
  ManagedActionsResult,
  RefreshManagedActionsResult,
  SearchGitHubWorkflowsResult,
} from '../../../shared/api';

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface SearchWorkflowsArgs {
  accountId: string;
  query: string;
}

interface PersistManagedWorkflowArgs {
  accountId: string;
  workflow: GitHubWorkflowSummary | GitHubManagedWorkflow;
}

interface RemoveManagedWorkflowArgs {
  accountId: string;
  repoFullName: string;
  workflowId: number;
}

interface RefreshManagedWorkflowsArgs {
  accountId: string;
  workflows?: GitHubManagedWorkflowReference[];
}

interface DispatchManagedWorkflowArgs {
  accountId: string;
  workflow: GitHubManagedWorkflow;
  inputs: Record<string, string>;
}

interface DispatchDialogState {
  open: boolean;
  workflow: GitHubManagedWorkflow | null;
  formValues: Record<string, string>;
  submitStatus: FetchStatus;
  error: string | null;
  successMessage: string | null;
}

export interface ActionManagementState {
  activeAccountId: string | null;
  loadStatus: FetchStatus;
  persistStatus: FetchStatus;
  searchStatus: FetchStatus;
  refreshStatus: FetchStatus;
  loadError: string | null;
  persistError: string | null;
  searchError: string | null;
  refreshError: string | null;
  searchQuery: string;
  searchScannedRepoCount: number;
  searchResults: GitHubWorkflowSummary[];
  managedReferences: GitHubManagedWorkflowReference[];
  managedWorkflows: GitHubManagedWorkflow[];
  failedRefreshCount: number;
  dispatchDialog: DispatchDialogState;
}

const initialState: ActionManagementState = {
  activeAccountId: null,
  loadStatus: 'idle',
  persistStatus: 'idle',
  searchStatus: 'idle',
  refreshStatus: 'idle',
  loadError: null,
  persistError: null,
  searchError: null,
  refreshError: null,
  searchQuery: '',
  searchScannedRepoCount: 0,
  searchResults: [],
  managedReferences: [],
  managedWorkflows: [],
  failedRefreshCount: 0,
  dispatchDialog: {
    open: false,
    workflow: null,
    formValues: {},
    submitStatus: 'idle',
    error: null,
    successMessage: null,
  },
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

function toWorkflowReference(
  workflow: GitHubWorkflowSummary | GitHubManagedWorkflow,
): GitHubManagedWorkflowReference {
  return {
    accountId: workflow.accountId,
    repoFullName: workflow.repoFullName,
    repoHtmlUrl: workflow.repoHtmlUrl,
    defaultBranch: workflow.defaultBranch,
    workflowId: workflow.workflowId,
    workflowName: workflow.workflowName,
    workflowPath: workflow.workflowPath,
    workflowHtmlUrl: workflow.workflowHtmlUrl,
    supportsDispatch: workflow.supportsDispatch,
  };
}

function buildDispatchDefaults(workflow: GitHubManagedWorkflow): Record<string, string> {
  return Object.fromEntries(
    workflow.dispatchInputs.map((input) => [input.name, input.defaultValue ?? '']),
  );
}

export const loadManagedWorkflows = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  string,
  { rejectValue: string }
>(
  'actionManagement/loadManagedWorkflows',
  async (accountId, { rejectWithValue }) => {
    try {
      const result = await window.hagihub.getManagedActions(accountId);
      return { accountId, result };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.loadManagedActionsFailed'));
    }
  },
);

export const searchManagedWorkflows = createAsyncThunk<
  { accountId: string; result: SearchGitHubWorkflowsResult },
  SearchWorkflowsArgs,
  { rejectValue: string }
>(
  'actionManagement/searchManagedWorkflows',
  async ({ accountId, query }, { rejectWithValue }) => {
    try {
      const result = await window.hagihub.searchGitHubWorkflows(accountId, query);
      return { accountId, result };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.searchWorkflowsFailed'));
    }
  },
);

export const addManagedWorkflow = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  PersistManagedWorkflowArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/addManagedWorkflow',
  async ({ accountId, workflow }, { getState, rejectWithValue }) => {
    try {
      const existing = getState().actionManagement.managedReferences;
      const nextReference = {
        ...toWorkflowReference(workflow),
        accountId,
      };

      const isAlreadyManaged = existing.some(
        (item) => item.repoFullName === nextReference.repoFullName && item.workflowId === nextReference.workflowId,
      );

      if (isAlreadyManaged) {
        return { accountId, result: { workflows: existing } };
      }

      const result = await window.hagihub.saveManagedActions(accountId, [...existing, nextReference]);
      return { accountId, result };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.saveManagedActionsFailed'));
    }
  },
);

export const removeManagedWorkflow = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  RemoveManagedWorkflowArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/removeManagedWorkflow',
  async ({ accountId, repoFullName, workflowId }, { getState, rejectWithValue }) => {
    try {
      const nextWorkflows = getState().actionManagement.managedReferences.filter(
        (workflow) => !(workflow.repoFullName === repoFullName && workflow.workflowId === workflowId),
      );
      const result = await window.hagihub.saveManagedActions(accountId, nextWorkflows);
      return { accountId, result };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.saveManagedActionsFailed'));
    }
  },
);

export const refreshManagedWorkflows = createAsyncThunk<
  { accountId: string; result: RefreshManagedActionsResult },
  RefreshManagedWorkflowsArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/refreshManagedWorkflows',
  async ({ accountId, workflows }, { getState, rejectWithValue }) => {
    try {
      const targetWorkflows = workflows ?? getState().actionManagement.managedReferences;

      if (targetWorkflows.length === 0) {
        return {
          accountId,
          result: {
            workflows: [],
            failedCount: 0,
          },
        };
      }

      const result = await window.hagihub.refreshManagedActionRuns(accountId, targetWorkflows);
      return { accountId, result };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.refreshManagedActionsFailed'));
    }
  },
);

export const dispatchManagedWorkflow = createAsyncThunk<
  { accountId: string; workflowKey: string; result: GitHubWorkflowDispatchResponse },
  DispatchManagedWorkflowArgs,
  { rejectValue: string }
>(
  'actionManagement/dispatchManagedWorkflow',
  async ({ accountId, workflow, inputs }, { rejectWithValue }) => {
    try {
      const result = await window.hagihub.dispatchGitHubWorkflow(accountId, {
        repoFullName: workflow.repoFullName,
        workflowId: workflow.workflowId,
        ref: workflow.defaultBranch,
        inputs,
      });
      return {
        accountId,
        workflowKey: `${workflow.repoFullName}#${workflow.workflowId}`,
        result,
      };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.dispatchWorkflowFailed'));
    }
  },
);

const actionManagementSlice = createSlice({
  name: 'actionManagement',
  initialState,
  reducers: {
    resetActionManagement() {
      return initialState;
    },
    setSearchQuery(state, action: PayloadAction<string>) {
      state.searchQuery = action.payload;
    },
    clearSearchResults(state) {
      state.searchStatus = 'idle';
      state.searchError = null;
      state.searchScannedRepoCount = 0;
      state.searchResults = [];
    },
    openDispatchDialog(state, action: PayloadAction<GitHubManagedWorkflow>) {
      state.dispatchDialog.open = true;
      state.dispatchDialog.workflow = action.payload;
      state.dispatchDialog.formValues = buildDispatchDefaults(action.payload);
      state.dispatchDialog.submitStatus = 'idle';
      state.dispatchDialog.error = null;
      state.dispatchDialog.successMessage = null;
    },
    closeDispatchDialog(state) {
      state.dispatchDialog.open = false;
      state.dispatchDialog.workflow = null;
      state.dispatchDialog.formValues = {};
      state.dispatchDialog.submitStatus = 'idle';
      state.dispatchDialog.error = null;
      state.dispatchDialog.successMessage = null;
    },
    setDispatchInput(state, action: PayloadAction<{ name: string; value: string }>) {
      state.dispatchDialog.formValues[action.payload.name] = action.payload.value;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadManagedWorkflows.pending, (state, action) => {
        state.activeAccountId = action.meta.arg;
        state.loadStatus = 'loading';
        state.loadError = null;
        state.persistError = null;
        state.refreshError = null;
        state.failedRefreshCount = 0;
        state.managedReferences = [];
        state.managedWorkflows = [];
      })
      .addCase(loadManagedWorkflows.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.loadStatus = 'succeeded';
        state.managedReferences = action.payload.result.workflows;
        state.managedWorkflows = [];
        state.loadError = null;
      })
      .addCase(loadManagedWorkflows.rejected, (state, action) => {
        state.loadStatus = 'failed';
        state.loadError = action.payload ?? i18n.t('errors.loadManagedActionsFailed', { ns: 'github' });
      })
      .addCase(searchManagedWorkflows.pending, (state, action) => {
        state.activeAccountId = action.meta.arg.accountId;
        state.searchStatus = 'loading';
        state.searchError = null;
      })
      .addCase(searchManagedWorkflows.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.searchStatus = 'succeeded';
        state.searchResults = action.payload.result.workflows;
        state.searchScannedRepoCount = action.payload.result.scannedRepoCount;
        state.searchError = null;
      })
      .addCase(searchManagedWorkflows.rejected, (state, action) => {
        state.searchStatus = 'failed';
        state.searchError = action.payload ?? i18n.t('errors.searchWorkflowsFailed', { ns: 'github' });
        state.searchResults = [];
        state.searchScannedRepoCount = 0;
      })
      .addCase(addManagedWorkflow.pending, (state) => {
        state.persistStatus = 'loading';
        state.persistError = null;
      })
      .addCase(addManagedWorkflow.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.persistStatus = 'succeeded';
        state.managedReferences = action.payload.result.workflows;
        state.persistError = null;
      })
      .addCase(addManagedWorkflow.rejected, (state, action) => {
        state.persistStatus = 'failed';
        state.persistError = action.payload ?? i18n.t('errors.saveManagedActionsFailed', { ns: 'github' });
      })
      .addCase(removeManagedWorkflow.pending, (state) => {
        state.persistStatus = 'loading';
        state.persistError = null;
      })
      .addCase(removeManagedWorkflow.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.persistStatus = 'succeeded';
        state.managedReferences = action.payload.result.workflows;
        state.managedWorkflows = state.managedWorkflows.filter((workflow) =>
          action.payload.result.workflows.some(
            (reference) => reference.repoFullName === workflow.repoFullName && reference.workflowId === workflow.workflowId,
          ));
        state.persistError = null;
      })
      .addCase(removeManagedWorkflow.rejected, (state, action) => {
        state.persistStatus = 'failed';
        state.persistError = action.payload ?? i18n.t('errors.saveManagedActionsFailed', { ns: 'github' });
      })
      .addCase(refreshManagedWorkflows.pending, (state) => {
        state.refreshStatus = 'loading';
        state.refreshError = null;
      })
      .addCase(refreshManagedWorkflows.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.refreshStatus = 'succeeded';
        state.managedWorkflows = action.payload.result.workflows;
        state.failedRefreshCount = action.payload.result.failedCount;
        state.refreshError = null;
      })
      .addCase(refreshManagedWorkflows.rejected, (state, action) => {
        state.refreshStatus = 'failed';
        state.refreshError = action.payload ?? i18n.t('errors.refreshManagedActionsFailed', { ns: 'github' });
      })
      .addCase(dispatchManagedWorkflow.pending, (state) => {
        state.dispatchDialog.submitStatus = 'loading';
        state.dispatchDialog.error = null;
        state.dispatchDialog.successMessage = null;
      })
      .addCase(dispatchManagedWorkflow.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.dispatchDialog.submitStatus = 'succeeded';
        state.dispatchDialog.error = null;
        state.dispatchDialog.successMessage = action.payload.result.message;
      })
      .addCase(dispatchManagedWorkflow.rejected, (state, action) => {
        state.dispatchDialog.submitStatus = 'failed';
        state.dispatchDialog.error = action.payload ?? i18n.t('errors.dispatchWorkflowFailed', { ns: 'github' });
        state.dispatchDialog.successMessage = null;
      });
  },
});

export const {
  clearSearchResults,
  closeDispatchDialog,
  openDispatchDialog,
  resetActionManagement,
  setDispatchInput,
  setSearchQuery,
} = actionManagementSlice.actions;

export default actionManagementSlice.reducer;
