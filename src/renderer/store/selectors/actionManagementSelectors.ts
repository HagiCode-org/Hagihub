import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/store';

export const selectActionManagementState = (state: RootState) => state.actionManagement;
export const selectActionTransferModalState = (state: RootState) => state.actionManagement.transferModal;

export const selectMonitoredManagedWorkflowCount = createSelector(
  [selectActionManagementState],
  (actionManagement) => actionManagement.managedReferences.filter((workflow) => workflow.monitored === true).length,
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
