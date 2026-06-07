import { createAction, type TypedStartListening } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '@/store';
import { listenerMiddleware } from './listenerMiddleware';
import { loadManagedWorkflows, refreshManagedWorkflows, resetActionManagement } from './slices/actionManagementSlice';
import { fetchAccounts } from './slices/githubAccountsSlice';
import { fetchRepos, clearRepos } from './slices/githubReposSlice';
import { fetchAppInfo } from './slices/hubSlice';
import { setActiveSection } from './slices/navigationSlice';

export const appStarted = createAction('app/started');

type AppStartListening = TypedStartListening<RootState, AppDispatch>;

const startAppListening = listenerMiddleware.startListening as AppStartListening;

let listenersRegistered = false;

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
}
