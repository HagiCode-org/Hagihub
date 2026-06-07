import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  dedupeWorkflowSummaries,
  getMonitoredManagedWorkflowReferences,
  toWorkflowReference,
  workflowKey,
  type TransferLoadProgress,
} from '@/features/action-management/model';
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

const WORKFLOW_LOAD_TIMEOUT_MS = 30_000;

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

interface TransferLoadProgressPayload {
  candidateWorkflows: GitHubWorkflowSummary[];
  loadErrors: Record<string, string>;
  loadProgress: TransferLoadProgress;
}

export const transferLoadProgressUpdated = createAction<TransferLoadProgressPayload>(
  'actionManagement/transferLoadProgressUpdated',
);

function createTransferLoadProgressPayload(
  candidateWorkflows: GitHubWorkflowSummary[],
  loadErrors: Record<string, string>,
  loadProgress: TransferLoadProgress,
): TransferLoadProgressPayload {
  return {
    candidateWorkflows: dedupeWorkflowSummaries([...candidateWorkflows]),
    loadErrors: { ...loadErrors },
    loadProgress,
  };
}

function selectMonitoredManagedWorkflowReferences(state: RootState): GitHubManagedWorkflowReference[] {
  return getMonitoredManagedWorkflowReferences(state.actionManagement.managedReferences);
}

function toMessage(error: unknown, fallbackKey: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return i18n.t(fallbackKey, { ns: 'github' });
}

interface RejectableThunkApi<TResult, TDispatch> {
  dispatch: TDispatch;
  getState: () => RootState;
  rejectWithValue: (value: string) => TResult;
}

async function runWithErrorMapping<TResult, TSuccess>(
  rejectWithValue: (value: string) => TResult,
  fallbackKey: string,
  operation: () => Promise<TSuccess>,
): Promise<TSuccess | TResult> {
  try {
    return await operation();
  } catch (error) {
    return rejectWithValue(toMessage(error, fallbackKey));
  }
}

async function runForActiveAccount<TResult, TDispatch>(
  api: RejectableThunkApi<TResult, TDispatch>,
  options: {
    missingAccountErrorKey: string;
    failureErrorKey: string;
    run: (accountId: string, state: RootState) => Promise<void> | void;
  },
): Promise<void | TResult> {
  const state = api.getState();
  const accountId = state.githubAccounts.activeAccountId;

  if (!accountId) {
    return api.rejectWithValue(i18n.t(options.missingAccountErrorKey, { ns: 'github' }));
  }

  try {
    await options.run(accountId, state);
  } catch (error) {
    return api.rejectWithValue(toMessage(error, options.failureErrorKey));
  }
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
  async (accountId, { rejectWithValue }) => runWithErrorMapping(
    rejectWithValue,
    'errors.loadManagedActionsFailed',
    async () => {
      const result = await window.hagihub.getManagedActions(accountId);
      return { accountId, result };
    },
  ),
);

export const loadManagedWorkflowsForActiveAccount = createAsyncThunk<
  void,
  void,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/loadManagedWorkflowsForActiveAccount',
  async (_, api) => runForActiveAccount(api, {
    missingAccountErrorKey: 'errors.loadManagedActionsFailed',
    failureErrorKey: 'errors.loadManagedActionsFailed',
    run: async (accountId) => {
      await api.dispatch(loadManagedWorkflows(accountId)).unwrap();
    },
  }),
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

    dispatch(transferLoadProgressUpdated(createTransferLoadProgressPayload(
      candidateWorkflows,
      loadErrors,
      {
        current: 0,
        total,
      },
    )));

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

      dispatch(transferLoadProgressUpdated(createTransferLoadProgressPayload(
        candidateWorkflows,
        loadErrors,
        {
          current: index + 1,
          total,
        },
      )));
    }

    return {
      accountId,
      candidateWorkflows: dedupeWorkflowSummaries([...candidateWorkflows]),
      loadErrors: { ...loadErrors },
    };
  },
);

export const addManagedWorkflow = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  PersistManagedWorkflowArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/addManagedWorkflow',
  async ({ accountId, workflow }, { getState, rejectWithValue }) => runWithErrorMapping(
    rejectWithValue,
    'errors.saveManagedActionsFailed',
    async () => {
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
    },
  ),
);

export const batchSaveManagedWorkflows = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  BatchSaveManagedWorkflowsArgs,
  { rejectValue: string }
>(
  'actionManagement/batchSaveManagedWorkflows',
  async ({ accountId, stagedSelection }, { rejectWithValue }) => runWithErrorMapping(
    rejectWithValue,
    'errors.saveManagedActionsFailed',
    async () => {
      const result = await window.hagihub.saveManagedActions(accountId, stagedSelection);
      return { accountId, result };
    },
  ),
);

export const toggleMonitoring = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  ToggleMonitoringArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/toggleMonitoring',
  async ({ accountId, repoFullName, workflowId }, { getState, rejectWithValue }) => runWithErrorMapping(
    rejectWithValue,
    'errors.saveManagedActionsFailed',
    async () => {
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
    },
  ),
);

export const removeManagedWorkflow = createAsyncThunk<
  { accountId: string; result: ManagedActionsResult },
  RemoveManagedWorkflowArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/removeManagedWorkflow',
  async ({ accountId, repoFullName, workflowId }, { getState, rejectWithValue }) => runWithErrorMapping(
    rejectWithValue,
    'errors.saveManagedActionsFailed',
    async () => {
      const nextWorkflows = getState().actionManagement.managedReferences.filter(
        (workflow) => !(workflow.repoFullName === repoFullName && workflow.workflowId === workflowId),
      );
      const result = await window.hagihub.saveManagedActions(accountId, nextWorkflows);
      return { accountId, result };
    },
  ),
);

export const refreshManagedWorkflows = createAsyncThunk<
  { accountId: string; result: RefreshManagedActionsResult },
  RefreshManagedWorkflowsArgs,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/refreshManagedWorkflows',
  async ({ accountId, workflows }, { getState, rejectWithValue }) => runWithErrorMapping(
    rejectWithValue,
    'errors.refreshManagedActionsFailed',
    async () => {
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
    },
  ),
);

export const refreshManagedWorkflowsForActiveAccount = createAsyncThunk<
  void,
  { workflows?: GitHubManagedWorkflowReference[] } | void,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/refreshManagedWorkflowsForActiveAccount',
  async (args, api) => runForActiveAccount(api, {
    missingAccountErrorKey: 'errors.refreshManagedActionsFailed',
    failureErrorKey: 'errors.refreshManagedActionsFailed',
    run: async (accountId) => {
      await api.dispatch(refreshManagedWorkflows({
        accountId,
        workflows: args?.workflows,
      })).unwrap();
    },
  }),
);

export const refreshMonitoredWorkflowsForActiveAccount = createAsyncThunk<
  void,
  void,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/refreshMonitoredWorkflowsForActiveAccount',
  async (_, api) => runForActiveAccount(api, {
    missingAccountErrorKey: 'errors.refreshManagedActionsFailed',
    failureErrorKey: 'errors.refreshManagedActionsFailed',
    run: async (_, state) => {
      const monitoredReferences = selectMonitoredManagedWorkflowReferences(state);

      if (monitoredReferences.length === 0) {
        return;
      }

      await api.dispatch(refreshManagedWorkflowsForActiveAccount({
        workflows: monitoredReferences,
      })).unwrap();
    },
  }),
);

export const dispatchManagedWorkflow = createAsyncThunk<
  { accountId: string; workflowKey: string; result: GitHubWorkflowDispatchResponse },
  DispatchManagedWorkflowArgs,
  { rejectValue: string }
>(
  'actionManagement/dispatchManagedWorkflow',
  async ({ accountId, workflow, inputs }, { rejectWithValue }) => runWithErrorMapping(
    rejectWithValue,
    'errors.dispatchWorkflowFailed',
    async () => {
      const result = await window.hagihub.dispatchGitHubWorkflow(accountId, {
        repoFullName: workflow.repoFullName,
        workflowId: workflow.workflowId,
        ref: workflow.defaultBranch,
        inputs,
      });
      return {
        accountId,
        workflowKey: workflowKey(workflow),
        result,
      };
    },
  ),
);

export const submitDispatchDialog = createAsyncThunk<
  void,
  void,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/submitDispatchDialog',
  async (_, api) => runForActiveAccount(api, {
    missingAccountErrorKey: 'errors.dispatchWorkflowFailed',
    failureErrorKey: 'errors.dispatchWorkflowFailed',
    run: async (accountId, state) => {
      const { workflow, formValues } = state.actionManagement.dispatchDialog;

      if (!workflow) {
        throw new Error(i18n.t('errors.dispatchWorkflowFailed', { ns: 'github' }));
      }

      await api.dispatch(dispatchManagedWorkflow({
        accountId,
        workflow,
        inputs: formValues,
      })).unwrap();
    },
  }),
);

export const toggleMonitoringForActiveAccount = createAsyncThunk<
  void,
  Pick<GitHubManagedWorkflowReference, 'repoFullName' | 'workflowId'>,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/toggleMonitoringForActiveAccount',
  async ({ repoFullName, workflowId }, api) => runForActiveAccount(api, {
    missingAccountErrorKey: 'errors.saveManagedActionsFailed',
    failureErrorKey: 'errors.saveManagedActionsFailed',
    run: async (accountId) => {
      await api.dispatch(toggleMonitoring({
        accountId,
        repoFullName,
        workflowId,
      })).unwrap();
    },
  }),
);

export const removeManagedWorkflowForActiveAccount = createAsyncThunk<
  void,
  Pick<GitHubManagedWorkflowReference, 'repoFullName' | 'workflowId'>,
  { state: RootState; rejectValue: string }
>(
  'actionManagement/removeManagedWorkflowForActiveAccount',
  async ({ repoFullName, workflowId }, api) => runForActiveAccount(api, {
    missingAccountErrorKey: 'errors.saveManagedActionsFailed',
    failureErrorKey: 'errors.saveManagedActionsFailed',
    run: async (accountId) => {
      await api.dispatch(removeManagedWorkflow({
        accountId,
        repoFullName,
        workflowId,
      })).unwrap();
    },
  }),
);
