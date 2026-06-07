import { createAction, type TypedStartListening } from '@reduxjs/toolkit';
import { workflowKey } from '@/features/action-management/model';
import i18n from '@/locales';
import type { AppDispatch, RootState } from '@/store';
import { selectActionMonitoringView } from '@/store/selectors';
import { listenerMiddleware } from './listenerMiddleware';
import {
  batchSaveManagedWorkflows,
  closeDispatchDialog,
  closeTransferModal,
  dispatchManagedWorkflow,
  loadManagedWorkflows,
  refreshManagedWorkflows,
  resetActionManagement,
} from './slices/actionManagementSlice';
import { fetchAccounts } from './slices/githubAccountsSlice';
import { fetchRepos, clearRepos } from './slices/githubReposSlice';
import { fetchAppInfo } from './slices/hubSlice';
import { setActiveSection } from './slices/navigationSlice';
import type { GitHubManagedWorkflow } from '../../shared/api';

export const appStarted = createAction('app/started');

type AppStartListening = TypedStartListening<RootState, AppDispatch>;

const startAppListening = listenerMiddleware.startListening as AppStartListening;

let listenersRegistered = false;

function isRunningState(state: GitHubManagedWorkflow['latestRunState'] | undefined): boolean {
  return state === 'in_progress' || state === 'waiting';
}

function isTerminalState(state: GitHubManagedWorkflow['latestRunState']): state is 'success' | 'failure' {
  return state === 'success' || state === 'failure';
}

async function sendWorkflowCompletionNotification(workflow: GitHubManagedWorkflow): Promise<void> {
  const statusKey = workflow.latestRunState === 'success' ? 'success' : 'failure';
  const detailLine = workflow.latestRun?.displayTitle?.trim();
  const body = detailLine
    ? `${workflow.repoFullName} - ${i18n.t(`actionManagement.actionMonitoring.state.${statusKey}`, { ns: 'github' })}\n${detailLine}`
    : `${workflow.repoFullName} - ${i18n.t(`actionManagement.actionMonitoring.state.${statusKey}`, { ns: 'github' })}`;

  try {
    const result = await window.hagihub.sendNotification({
      title: `${workflow.workflowName} ${i18n.t('actionManagement.actionMonitoring.notification.completed', { ns: 'github' })}`,
      body,
      level: workflow.latestRunState === 'success' ? 'success' : 'error',
      clickAction: { type: 'focus-window', section: 'actions' },
    });

    if (!result.success) {
      console.warn('[action-monitoring] Failed to send workflow notification', {
        workflowKey: workflowKey(workflow),
        error: result.error,
      });
    }
  } catch (error) {
    console.warn('[action-monitoring] Failed to send workflow notification', {
      workflowKey: workflowKey(workflow),
      error,
    });
  }
}

function syncReposForActiveAccount(dispatch: AppDispatch, state: RootState): void {
  const accountId = state.githubAccounts.activeAccountId;

  if (!accountId) {
    dispatch(clearRepos());
    return;
  }

  const { activeAccountId, fetchStatus } = state.githubRepos;
  const hasFreshRepos = activeAccountId === accountId && (fetchStatus === 'loading' || fetchStatus === 'succeeded');

  if (!hasFreshRepos) {
    void dispatch(fetchRepos({ accountId }));
  }
}

function syncManagedActionsForActiveAccount(dispatch: AppDispatch, state: RootState): void {
  const accountId = state.githubAccounts.activeAccountId;

  if (!accountId) {
    dispatch(resetActionManagement());
    return;
  }

  const { activeAccountId, loadStatus } = state.actionManagement;
  const hasFreshActions = activeAccountId === accountId && (loadStatus === 'loading' || loadStatus === 'succeeded');

  if (!hasFreshActions) {
    void dispatch(loadManagedWorkflows(accountId));
  }
}

function syncSectionData(dispatch: AppDispatch, state: RootState): void {
  if (state.navigation.activeSection === 'repos') {
    syncReposForActiveAccount(dispatch, state);
    return;
  }

  if (state.navigation.activeSection === 'actions') {
    syncReposForActiveAccount(dispatch, state);
    syncManagedActionsForActiveAccount(dispatch, state);
  }
}

export function registerStoreListeners(): void {
  if (listenersRegistered) {
    return;
  }

  listenersRegistered = true;

  startAppListening({
    actionCreator: appStarted,
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState();

      if (state.hub.loadStatus === 'idle') {
        void listenerApi.dispatch(fetchAppInfo());
      }

      if (state.githubAccounts.fetchStatus === 'idle') {
        void listenerApi.dispatch(fetchAccounts());
      }
    },
  });

  startAppListening({
    actionCreator: setActiveSection,
    effect: async (_, listenerApi) => {
      syncSectionData(listenerApi.dispatch, listenerApi.getState());
    },
  });

  startAppListening({
    predicate: (_, currentState, previousState) => (
      previousState.githubAccounts.activeAccountId !== currentState.githubAccounts.activeAccountId
    ),
    effect: async (_, listenerApi) => {
      const state = listenerApi.getState();

      if (!state.githubAccounts.activeAccountId) {
        listenerApi.dispatch(clearRepos());
        listenerApi.dispatch(resetActionManagement());
        return;
      }

      syncSectionData(listenerApi.dispatch, state);
    },
  });

  startAppListening({
    actionCreator: loadManagedWorkflows.fulfilled,
    effect: async (action, listenerApi) => {
      if (action.payload.result.workflows.length === 0) {
        return;
      }

      const state = listenerApi.getState();

      if (state.githubAccounts.activeAccountId !== action.payload.accountId) {
        return;
      }

      void listenerApi.dispatch(refreshManagedWorkflows({
        accountId: action.payload.accountId,
        workflows: action.payload.result.workflows,
      }));
    },
  });

  startAppListening({
    actionCreator: refreshManagedWorkflows.fulfilled,
    effect: async (action, listenerApi) => {
      const state = listenerApi.getState();

      if (state.githubAccounts.activeAccountId !== action.payload.accountId) {
        return;
      }

      const previousState = listenerApi.getOriginalState();
      const monitoringView = selectActionMonitoringView(state);
      const monitoredWorkflowKeys = new Set(monitoringView.monitoredReferences.map((workflow) => workflowKey(workflow)));

      if (monitoredWorkflowKeys.size === 0) {
        return;
      }

      const previousWorkflows = new Map(
        previousState.actionManagement.managedWorkflows.map((workflow) => [workflowKey(workflow), workflow]),
      );

      for (const workflow of state.actionManagement.managedWorkflows) {
        const key = workflowKey(workflow);

        if (!monitoredWorkflowKeys.has(key)) {
          continue;
        }

        const previousWorkflow = previousWorkflows.get(key);

        if (!previousWorkflow || !isRunningState(previousWorkflow.latestRunState) || !isTerminalState(workflow.latestRunState)) {
          continue;
        }

        await sendWorkflowCompletionNotification(workflow);
      }
    },
  });

  startAppListening({
    actionCreator: batchSaveManagedWorkflows.fulfilled,
    effect: async (action, listenerApi) => {
      const state = listenerApi.getState();

      if (state.githubAccounts.activeAccountId !== action.payload.accountId) {
        return;
      }

      listenerApi.dispatch(closeTransferModal());
      void listenerApi.dispatch(refreshManagedWorkflows({
        accountId: action.payload.accountId,
      }));
    },
  });

  startAppListening({
    actionCreator: dispatchManagedWorkflow.fulfilled,
    effect: async (action, listenerApi) => {
      const state = listenerApi.getState();

      if (state.githubAccounts.activeAccountId !== action.payload.accountId) {
        return;
      }

      listenerApi.dispatch(closeDispatchDialog());
      void listenerApi.dispatch(refreshManagedWorkflows({
        accountId: action.payload.accountId,
      }));
    },
  });
}
