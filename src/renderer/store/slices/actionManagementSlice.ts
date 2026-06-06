import { createAction, createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type { RootState } from '@/store';
import type {
  GitHubManagedWorkflow,
  GitHubManagedWorkflowReference,
  GitHubWorkflowDispatchResponse,
  GitHubWorkflowSummary,
  ManagedActionsResult,
  RefreshManagedActionsResult,
} from '../../../shared/api';

export type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
export type TransferPhase = 1 | 2 | 3;

const WORKFLOW_LOAD_TIMEOUT_MS = 30_000;
const GLOBAL_TRANSFER_LOAD_ERROR_KEY = '__global__';

interface PersistManagedWorkflowArgs {
  accountId: string;
  workflow: GitHubWorkflowSummary | GitHubManagedWorkflow;
}

interface RemoveManagedWorkflowArgs {
  accountId: string;
  repoFullName: string;
  workflowId: number;
}

interface ToggleMonitoringArgs {
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

interface BatchSaveManagedWorkflowsArgs {
  accountId: string;
  stagedSelection: GitHubManagedWorkflowReference[];
}

interface DispatchDialogState {
  open: boolean;
  workflow: GitHubManagedWorkflow | null;
  formValues: Record<string, string>;
  submitStatus: FetchStatus;
  error: string | null;
  successMessage: string | null;
}

interface TransferLoadProgress {
  current: number;
  total: number;
}

export interface TransferModalState {
  open: boolean;
  phase: TransferPhase;
  selectedRepoFullNames: string[];
  candidateWorkflows: GitHubWorkflowSummary[];
  stagedSelection: GitHubManagedWorkflowReference[];
  loadProgress: TransferLoadProgress;
  loadErrors: Record<string, string>;
  saveStatus: FetchStatus;
  saveError: string | null;
}

export interface ActionManagementState {
  activeAccountId: string | null;
  loadStatus: FetchStatus;
  persistStatus: FetchStatus;
  refreshStatus: FetchStatus;
  loadError: string | null;
  persistError: string | null;
  refreshError: string | null;
  managedReferences: GitHubManagedWorkflowReference[];
  managedWorkflows: GitHubManagedWorkflow[];
  failedRefreshCount: number;
  dispatchDialog: DispatchDialogState;
  transferModal: TransferModalState;
}

interface TransferLoadProgressPayload {
  candidateWorkflows: GitHubWorkflowSummary[];
  loadErrors: Record<string, string>;
  loadProgress: TransferLoadProgress;
}

const transferLoadProgressUpdated = createAction<TransferLoadProgressPayload>(
  'actionManagement/transferLoadProgressUpdated',
);

function createInitialTransferModalState(): TransferModalState {
  return {
    open: false,
    phase: 1,
    selectedRepoFullNames: [],
    candidateWorkflows: [],
    stagedSelection: [],
    loadProgress: {
      current: 0,
      total: 0,
    },
    loadErrors: {},
    saveStatus: 'idle',
    saveError: null,
  };
}

function createInitialState(): ActionManagementState {
  return {
    activeAccountId: null,
    loadStatus: 'idle',
    persistStatus: 'idle',
    refreshStatus: 'idle',
    loadError: null,
    persistError: null,
    refreshError: null,
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
    transferModal: createInitialTransferModalState(),
  };
}

const initialState = createInitialState();

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
  workflow: GitHubWorkflowSummary | GitHubManagedWorkflow | GitHubManagedWorkflowReference,
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
    monitored: workflow.monitored ?? false,
  };
}

function buildDispatchDefaults(workflow: GitHubManagedWorkflow): Record<string, string> {
  return Object.fromEntries(
    workflow.dispatchInputs.map((input) => [input.name, input.defaultValue ?? '']),
  );
}

function workflowKey(workflow: Pick<GitHubManagedWorkflowReference, 'repoFullName' | 'workflowId'>): string {
  return workflow.repoFullName + '#' + workflow.workflowId;
}

function dedupeWorkflowReferences(
  workflows: Array<GitHubWorkflowSummary | GitHubManagedWorkflow | GitHubManagedWorkflowReference>,
): GitHubManagedWorkflowReference[] {
  const seen = new Set<string>();
  const deduped: GitHubManagedWorkflowReference[] = [];

  for (const workflow of workflows) {
    const reference = toWorkflowReference(workflow);
    const key = workflowKey(reference);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(reference);
  }

  return deduped;
}

function dedupeWorkflowSummaries(workflows: GitHubWorkflowSummary[]): GitHubWorkflowSummary[] {
  const seen = new Set<string>();
  const deduped: GitHubWorkflowSummary[] = [];

  for (const workflow of workflows) {
    const key = workflowKey(workflow);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(workflow);
  }

  return deduped;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
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

export const loadMultiRepoWorkflows = createAsyncThunk<
  { accountId: string; candidateWorkflows: GitHubWorkflowSummary[]; loadErrors: Record<string, string> },
  { accountId: string },
  { state: RootState }
>(
  'actionManagement/loadMultiRepoWorkflows',
  async ({ accountId }, { dispatch, getState }) => {
    const selectedRepoFullNames = getState().actionManagement.transferModal.selectedRepoFullNames;
    const total = selectedRepoFullNames.length;
    const candidateWorkflows: GitHubWorkflowSummary[] = [];
    const loadErrors: Record<string, string> = {};

    dispatch(transferLoadProgressUpdated({
      candidateWorkflows,
      loadErrors,
      loadProgress: {
        current: 0,
        total,
      },
    }));

    for (let index = 0; index < selectedRepoFullNames.length; index += 1) {
      const repoFullName = selectedRepoFullNames[index];

      try {
        const result = await withTimeout(
          window.hagihub.listGitHubRepoWorkflows(accountId, repoFullName),
          WORKFLOW_LOAD_TIMEOUT_MS,
          i18n.t('errors.loadRepoWorkflowsTimedOut', { ns: 'github' }),
        );
        candidateWorkflows.push(...result.workflows);
      } catch (error) {
        loadErrors[repoFullName] = toMessage(error, 'errors.loadRepoWorkflowsFailed');
        console.warn('[action-management] Failed to load workflows for repository.', {
          accountId,
          repoFullName,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      dispatch(transferLoadProgressUpdated({
        candidateWorkflows: dedupeWorkflowSummaries(candidateWorkflows),
        loadErrors: { ...loadErrors },
        loadProgress: {
          current: index + 1,
          total,
        },
      }));
    }

    return {
      accountId,
      candidateWorkflows: dedupeWorkflowSummaries(candidateWorkflows),
      loadErrors,
    };
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
        monitored: false,
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

export const batchSaveManagedWorkflows = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  BatchSaveManagedWorkflowsArgs,
  { rejectValue: string }
>(
  'actionManagement/batchSaveManagedWorkflows',
  async ({ accountId, stagedSelection }, { rejectWithValue }) => {
    try {
      const result = await window.hagihub.saveManagedActions(accountId, stagedSelection);
      return { accountId, result };
    } catch (error) {
      return rejectWithValue(toMessage(error, 'errors.saveManagedActionsFailed'));
    }
  },
);

export const toggleMonitoring = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  ToggleMonitoringArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/toggleMonitoring',
  async ({ accountId, repoFullName, workflowId }, { getState, rejectWithValue }) => {
    try {
      const nextWorkflows = getState().actionManagement.managedReferences.map((workflow) => {
        if (workflow.repoFullName === repoFullName && workflow.workflowId === workflowId) {
          return {
            ...workflow,
            monitored: !(workflow.monitored === true),
          };
        }

        return {
          ...workflow,
          monitored: workflow.monitored ?? false,
        };
      });
      const result = await window.hagihub.saveManagedActions(accountId, nextWorkflows);
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
        workflowKey: workflow.repoFullName + '#' + workflow.workflowId,
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
      return createInitialState();
    },
    openTransferModal(state) {
      state.transferModal = {
        ...createInitialTransferModalState(),
        open: true,
        stagedSelection: [...state.managedReferences],
      };
    },
    closeTransferModal(state) {
      state.transferModal = createInitialTransferModalState();
    },
    setTransferPhase(state, action: PayloadAction<TransferPhase>) {
      state.transferModal.phase = action.payload;
    },
    toggleRepoSelection(state, action: PayloadAction<string>) {
      const repoFullName = action.payload;
      const currentSelection = new Set(state.transferModal.selectedRepoFullNames);

      if (currentSelection.has(repoFullName)) {
        state.transferModal.selectedRepoFullNames = state.transferModal.selectedRepoFullNames.filter(
          (item) => item !== repoFullName,
        );
        return;
      }

      state.transferModal.selectedRepoFullNames.push(repoFullName);
    },
    moveToStaged(
      state,
      action: PayloadAction<Array<GitHubWorkflowSummary | GitHubManagedWorkflowReference>>,
    ) {
      state.transferModal.stagedSelection = dedupeWorkflowReferences([
        ...state.transferModal.stagedSelection,
        ...action.payload,
      ]);
    },
    removeFromStaged(
      state,
      action: PayloadAction<Array<GitHubWorkflowSummary | GitHubManagedWorkflowReference>>,
    ) {
      const removedKeys = new Set(action.payload.map((workflow) => workflowKey(workflow)));
      state.transferModal.stagedSelection = state.transferModal.stagedSelection.filter(
        (workflow) => !removedKeys.has(workflowKey(workflow)),
      );
    },
    clearTransferLoadErrors(state) {
      state.transferModal.loadErrors = {};
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
      .addCase(transferLoadProgressUpdated, (state, action) => {
        if (!state.transferModal.open) {
          return;
        }

        state.transferModal.candidateWorkflows = action.payload.candidateWorkflows;
        state.transferModal.loadErrors = action.payload.loadErrors;
        state.transferModal.loadProgress = action.payload.loadProgress;
      })
      .addCase(loadManagedWorkflows.pending, (state, action) => {
        state.activeAccountId = action.meta.arg;
        state.loadStatus = 'loading';
        state.loadError = null;
        state.persistError = null;
        state.refreshError = null;
        state.failedRefreshCount = 0;
        state.managedReferences = [];
        state.managedWorkflows = [];
        state.transferModal = createInitialTransferModalState();
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
      .addCase(loadMultiRepoWorkflows.pending, (state) => {
        if (!state.transferModal.open) {
          return;
        }

        state.transferModal.candidateWorkflows = [];
        state.transferModal.loadErrors = {};
        state.transferModal.loadProgress = {
          current: 0,
          total: state.transferModal.selectedRepoFullNames.length,
        };
      })
      .addCase(loadMultiRepoWorkflows.fulfilled, (state, action) => {
        if (!state.transferModal.open) {
          return;
        }

        state.activeAccountId = action.payload.accountId;
        state.transferModal.candidateWorkflows = action.payload.candidateWorkflows;
        state.transferModal.loadErrors = action.payload.loadErrors;
        state.transferModal.loadProgress = {
          current: state.transferModal.selectedRepoFullNames.length,
          total: state.transferModal.selectedRepoFullNames.length,
        };
      })
      .addCase(loadMultiRepoWorkflows.rejected, (state, action) => {
        if (!state.transferModal.open) {
          return;
        }

        state.transferModal.loadErrors = {
          [GLOBAL_TRANSFER_LOAD_ERROR_KEY]: action.error.message ?? i18n.t('errors.loadRepoWorkflowsFailed', { ns: 'github' }),
        };
        state.transferModal.loadProgress = {
          current: state.transferModal.selectedRepoFullNames.length,
          total: state.transferModal.selectedRepoFullNames.length,
        };
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
      .addCase(batchSaveManagedWorkflows.pending, (state) => {
        state.transferModal.saveStatus = 'loading';
        state.transferModal.saveError = null;
      })
      .addCase(batchSaveManagedWorkflows.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.managedReferences = action.payload.result.workflows;
        state.managedWorkflows = state.managedWorkflows.filter((workflow) =>
          action.payload.result.workflows.some(
            (reference) => reference.repoFullName === workflow.repoFullName && reference.workflowId === workflow.workflowId,
          ),
        );
        state.transferModal.stagedSelection = action.payload.result.workflows;
        state.transferModal.saveStatus = 'succeeded';
        state.transferModal.saveError = null;
      })
      .addCase(batchSaveManagedWorkflows.rejected, (state, action) => {
        state.transferModal.saveStatus = 'failed';
        state.transferModal.saveError = action.payload ?? i18n.t('errors.saveManagedActionsFailed', { ns: 'github' });
      })
      .addCase(toggleMonitoring.pending, (state) => {
        state.persistStatus = 'loading';
        state.persistError = null;
      })
      .addCase(toggleMonitoring.fulfilled, (state, action) => {
        state.activeAccountId = action.payload.accountId;
        state.persistStatus = 'succeeded';
        state.managedReferences = action.payload.result.workflows;
        state.managedWorkflows = state.managedWorkflows.map((workflow) => {
          const reference = action.payload.result.workflows.find(
            (item) => item.repoFullName === workflow.repoFullName && item.workflowId === workflow.workflowId,
          );

          return reference ? { ...workflow, monitored: reference.monitored ?? false } : workflow;
        });
        state.persistError = null;
      })
      .addCase(toggleMonitoring.rejected, (state, action) => {
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
          ),
        );
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
  clearTransferLoadErrors,
  closeDispatchDialog,
  closeTransferModal,
  moveToStaged,
  openDispatchDialog,
  openTransferModal,
  removeFromStaged,
  resetActionManagement,
  setDispatchInput,
  setTransferPhase,
  toggleRepoSelection,
} = actionManagementSlice.actions;

export default actionManagementSlice.reducer;
