import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

export const selectRepoWorkspacesState = (state: RootState) => state.repoWorkspaces;

export function selectRepoWorkspaceEntry(state: RootState, workspaceKey: string) {
  return state.repoWorkspaces.byKey[workspaceKey];
}

export function selectRepoWorkspaceDetailsState(state: RootState, workspaceKey: string) {
  return state.repoWorkspaces.byKey[workspaceKey]?.details;
}

export function selectRepoWorkspaceReadmeState(state: RootState, workspaceKey: string) {
  return state.repoWorkspaces.byKey[workspaceKey]?.readme;
}

export function selectRepoWorkspaceLicenseState(state: RootState, workspaceKey: string) {
  return state.repoWorkspaces.byKey[workspaceKey]?.license;
}

export const selectRepoWorkspaceReadmeActiveVariant = createSelector(
  [
    (_state: RootState, workspaceKey: string) => workspaceKey,
    selectRepoWorkspacesState,
  ],
  (workspaceKey, repoWorkspaces) => {
    const readmeState = repoWorkspaces.byKey[workspaceKey]?.readme;
    if (!readmeState) {
      return null;
    }

    return readmeState.workspace.find((variant) => variant.path === readmeState.activePath)
      ?? readmeState.workspace[0]
      ?? null;
  },
);
