import { createSelector } from '@reduxjs/toolkit';
import {
  getMonitoredManagedWorkflowReferences,
  workflowKey,
} from '@/features/action-management/model';
import type { RootState } from '@/store';
import { selectGitHubRepoCollections } from './githubSelectors';

function repoMatchesSearch(repo: { fullName: string; name: string }, searchQuery: string): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return [repo.fullName, repo.name].join(' ').toLowerCase().includes(normalizedQuery);
}

function workflowMatchesSearch(
  workflow: { workflowName: string; workflowPath: string; repoFullName: string },
  searchQuery: string,
): boolean {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return true;
  }

  return workflow.workflowName.toLowerCase().includes(normalizedQuery)
    || workflow.workflowPath.toLowerCase().includes(normalizedQuery)
    || workflow.repoFullName.toLowerCase().includes(normalizedQuery);
}

function resolveOwnerKeyForRepo(
  repoFullName: string,
  personalRepos: Array<{ fullName: string }>,
  groupedRepos: Array<{ org: { login: string }; repos: Array<{ fullName: string }> }>,
): string | null {
  if (personalRepos.some((repo) => repo.fullName === repoFullName)) {
    return 'personal';
  }

  for (const group of groupedRepos) {
    if (group.repos.some((repo) => repo.fullName === repoFullName)) {
      return group.org.login;
    }
  }

  return null;
}

export const selectActionManagementState = (state: RootState) => state.actionManagement;
export const selectActionTransferModalState = (state: RootState) => state.actionManagement.transferModal;

export const selectMonitoredManagedWorkflowReferences = createSelector(
  [selectActionManagementState],
  (actionManagement) => getMonitoredManagedWorkflowReferences(actionManagement.managedReferences),
);

export const selectMonitoredManagedWorkflowCount = createSelector(
  [selectMonitoredManagedWorkflowReferences],
  (monitoredReferences) => monitoredReferences.length,
);

export const selectActionMonitoringView = createSelector(
  [selectActionManagementState, selectMonitoredManagedWorkflowReferences],
  (actionManagement, monitoredReferences) => ({
    canRequestRefresh: monitoredReferences.length > 0 && actionManagement.refreshStatus !== 'loading',
    monitoredReferenceSignature: monitoredReferences
      .map((workflow) => workflowKey(workflow))
      .sort()
      .join('|'),
    monitoredReferences,
  }),
);

export const selectActionManagementPageView = createSelector(
  [selectActionManagementState, selectMonitoredManagedWorkflowCount],
  (actionManagement, monitoredCount) => ({
    canRefreshManagedWorkflows: actionManagement.managedReferences.length > 0 && actionManagement.refreshStatus !== 'loading',
    failedRefreshCount: actionManagement.failedRefreshCount,
    isRefreshingManagedWorkflows: actionManagement.refreshStatus === 'loading',
    loadError: actionManagement.loadError,
    managedCount: actionManagement.managedReferences.length,
    managedWorkflowRows: actionManagement.managedWorkflows.map((workflow) => ({
      key: workflowKey(workflow),
      workflow,
    })),
    monitoredCount,
    persistError: actionManagement.persistError,
    refreshError: actionManagement.refreshError,
    showLoadFailedState: actionManagement.loadStatus === 'failed',
    showLoadingState: actionManagement.loadStatus === 'loading',
    showManagedEmptyState: actionManagement.managedReferences.length === 0,
    showManagedRefreshingState: actionManagement.managedReferences.length > 0
      && actionManagement.managedWorkflows.length === 0
      && actionManagement.refreshStatus === 'loading',
  }),
);

export const selectActionTransferModalView = createSelector(
  [selectActionTransferModalState],
  (transferModal) => ({
    canClose: transferModal.saveStatus !== 'loading',
    isLoadingWorkflows: transferModal.loadProgress.total > 0 && transferModal.loadProgress.current < transferModal.loadProgress.total,
    loadErrorEntries: Object.entries(transferModal.loadErrors),
    selectedRepoCount: transferModal.selectedRepoFullNames.length,
  }),
);

export const selectActionTransferRepoSelectionView = createSelector(
  [selectActionTransferModalState, selectGitHubRepoCollections],
  (transferModal, repoCollections) => {
    const repoGroups = [
      ...(repoCollections.personalRepos.length > 0
        ? [{ key: 'personal', repos: repoCollections.personalRepos }]
        : []),
      ...repoCollections.groupedRepos.map((group) => ({
        key: group.org.login,
        repos: group.repos,
      })),
    ];

    const fallbackOwnerKey = transferModal.selectedRepoFullNames
      .map((repoFullName) => resolveOwnerKeyForRepo(repoFullName, repoCollections.personalRepos, repoCollections.groupedRepos))
      .find((ownerKey): ownerKey is string => ownerKey !== null)
      ?? repoGroups[0]?.key
      ?? '';
    const activeOwnerKey = repoGroups.some((group) => group.key === transferModal.selectedOwnerKey)
      ? transferModal.selectedOwnerKey ?? ''
      : fallbackOwnerKey;
    const activeGroup = repoGroups.find((group) => group.key === activeOwnerKey) ?? repoGroups[0] ?? null;
    const selectedRepoSet = new Set(transferModal.selectedRepoFullNames);
    const visibleRepos = activeGroup?.repos.filter((repo) => repoMatchesSearch(repo, transferModal.repoSearchQuery)) ?? [];
    const activeSelectedCount = activeGroup?.repos.filter((repo) => selectedRepoSet.has(repo.fullName)).length ?? 0;
    const allActiveReposSelected = activeGroup !== null
      && activeGroup.repos.length > 0
      && activeSelectedCount === activeGroup.repos.length;

    return {
      activeGroup,
      activeOwnerKey,
      activeSelectedCount,
      allActiveReposSelected,
      repoGroups,
      repoSearchQuery: transferModal.repoSearchQuery,
      selectedRepoCount: transferModal.selectedRepoFullNames.length,
      selectedRepoSet,
      visibleRepos,
    };
  },
);

export const selectActionTransferWorkflowSelectionView = createSelector(
  [selectActionTransferModalState],
  (transferModal) => {
    const stagedKeySet = new Set(transferModal.stagedSelection.map((workflow) => workflowKey(workflow)));
    const visibleAvailableWorkflows = transferModal.candidateWorkflows.filter(
      (workflow) => !stagedKeySet.has(workflowKey(workflow)) && workflowMatchesSearch(workflow, transferModal.workflowSearchQuery),
    );
    const visibleAvailableKeySet = new Set(visibleAvailableWorkflows.map((workflow) => workflowKey(workflow)));
    const stagedSelectionKeySet = new Set(transferModal.stagedSelection.map((workflow) => workflowKey(workflow)));
    const selectedAvailable = visibleAvailableWorkflows.filter((workflow) =>
      transferModal.selectedAvailableWorkflowKeys.includes(workflowKey(workflow)),
    );
    const selectedStaged = transferModal.stagedSelection.filter((workflow) =>
      transferModal.selectedStagedWorkflowKeys.includes(workflowKey(workflow)),
    );

    return {
      selectedAvailable,
      selectedAvailableKeys: transferModal.selectedAvailableWorkflowKeys.filter((key) => visibleAvailableKeySet.has(key)),
      selectedStaged,
      selectedStagedKeys: transferModal.selectedStagedWorkflowKeys.filter((key) => stagedSelectionKeySet.has(key)),
      stagedSelection: transferModal.stagedSelection,
      visibleAvailableWorkflows,
      workflowSearchQuery: transferModal.workflowSearchQuery,
    };
  },
);
