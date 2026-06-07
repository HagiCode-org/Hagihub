import type { ActionReducerMapBuilder, PayloadAction } from '@reduxjs/toolkit';
import {
  buildDispatchDefaults,
  createInitialActionManagementState,
  createInitialDispatchDialogState,
  createInitialTransferModalState,
  dedupeWorkflowReferences,
  GLOBAL_TRANSFER_LOAD_ERROR_KEY,
  workflowKey,
  type ActionManagementState,
  type TransferPhase,
} from '@/features/action-management/model';
import i18n from '@/locales';
import type {
  GitHubManagedWorkflow,
  GitHubManagedWorkflowReference,
  GitHubWorkflowSummary,
} from '../../../shared/api';
import {
  addManagedWorkflow,
  batchSaveManagedWorkflows,
  dispatchManagedWorkflow,
  loadManagedWorkflows,
  loadMultiRepoWorkflows,
  refreshManagedWorkflows,
  removeManagedWorkflow,
  toggleMonitoring,
  transferLoadProgressUpdated,
} from './actionManagementThunks';

function retainManagedWorkflows(
  managedWorkflows: GitHubManagedWorkflow[],
  references: GitHubManagedWorkflowReference[],
): GitHubManagedWorkflow[] {
  return managedWorkflows.filter((workflow) =>
    references.some(
      (reference) => reference.repoFullName === workflow.repoFullName && reference.workflowId === workflow.workflowId,
    ),
  );
}

function syncManagedWorkflowMonitoringState(
  managedWorkflows: GitHubManagedWorkflow[],
  references: GitHubManagedWorkflowReference[],
): GitHubManagedWorkflow[] {
  return managedWorkflows.map((workflow) => {
    const reference = references.find(
      (item) => item.repoFullName === workflow.repoFullName && item.workflowId === workflow.workflowId,
    );

    return reference ? { ...workflow, monitored: reference.monitored ?? false } : workflow;
  });
}

export const actionManagementReducers = {
  resetActionManagement() {
    return createInitialActionManagementState();
  },
  openTransferModal(state: ActionManagementState) {
    state.transferModal = {
      ...createInitialTransferModalState(),
      open: true,
      stagedSelection: [...state.managedReferences],
    };
  },
  closeTransferModal(state: ActionManagementState) {
    state.transferModal = createInitialTransferModalState();
  },
  setTransferPhase(state: ActionManagementState, action: PayloadAction<TransferPhase>) {
    state.transferModal.phase = action.payload;
  },
  setTransferSelectedOwnerKey(state: ActionManagementState, action: PayloadAction<string>) {
    state.transferModal.selectedOwnerKey = action.payload;
  },
  setTransferRepoSearchQuery(state: ActionManagementState, action: PayloadAction<string>) {
    state.transferModal.repoSearchQuery = action.payload;
  },
  toggleRepoSelection(state: ActionManagementState, action: PayloadAction<string>) {
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
  setTransferRepoBatchSelection(
    state: ActionManagementState,
    action: PayloadAction<{ repoFullNames: string[]; select: boolean }>,
  ) {
    const { repoFullNames, select } = action.payload;
    const currentSelection = new Set(state.transferModal.selectedRepoFullNames);

    if (select) {
      for (const repoFullName of repoFullNames) {
        currentSelection.add(repoFullName);
      }
    } else {
      for (const repoFullName of repoFullNames) {
        currentSelection.delete(repoFullName);
      }
    }

    state.transferModal.selectedRepoFullNames = [...currentSelection];
  },
  setTransferWorkflowSearchQuery(state: ActionManagementState, action: PayloadAction<string>) {
    state.transferModal.workflowSearchQuery = action.payload;
  },
  toggleTransferAvailableWorkflowKey(state: ActionManagementState, action: PayloadAction<string>) {
    const key = action.payload;
    const selectedKeys = new Set(state.transferModal.selectedAvailableWorkflowKeys);

    if (selectedKeys.has(key)) {
      selectedKeys.delete(key);
    } else {
      selectedKeys.add(key);
    }

    state.transferModal.selectedAvailableWorkflowKeys = [...selectedKeys];
  },
  toggleTransferStagedWorkflowKey(state: ActionManagementState, action: PayloadAction<string>) {
    const key = action.payload;
    const selectedKeys = new Set(state.transferModal.selectedStagedWorkflowKeys);

    if (selectedKeys.has(key)) {
      selectedKeys.delete(key);
    } else {
      selectedKeys.add(key);
    }

    state.transferModal.selectedStagedWorkflowKeys = [...selectedKeys];
  },
  moveToStaged(
    state: ActionManagementState,
    action: PayloadAction<Array<GitHubWorkflowSummary | GitHubManagedWorkflowReference>>,
  ) {
    const movedKeys = new Set(action.payload.map((workflow) => workflowKey(workflow)));
    state.transferModal.stagedSelection = dedupeWorkflowReferences([
      ...state.transferModal.stagedSelection,
      ...action.payload,
    ]);
    state.transferModal.selectedAvailableWorkflowKeys = state.transferModal.selectedAvailableWorkflowKeys.filter(
      (key) => !movedKeys.has(key),
    );
  },
  removeFromStaged(
    state: ActionManagementState,
    action: PayloadAction<Array<GitHubWorkflowSummary | GitHubManagedWorkflowReference>>,
  ) {
    const removedKeys = new Set(action.payload.map((workflow) => workflowKey(workflow)));
    state.transferModal.stagedSelection = state.transferModal.stagedSelection.filter(
      (workflow) => !removedKeys.has(workflowKey(workflow)),
    );
    state.transferModal.selectedStagedWorkflowKeys = state.transferModal.selectedStagedWorkflowKeys.filter(
      (key) => !removedKeys.has(key),
    );
  },
  clearTransferLoadErrors(state: ActionManagementState) {
    state.transferModal.loadErrors = {};
  },
  openDispatchDialog(state: ActionManagementState, action: PayloadAction<GitHubManagedWorkflow>) {
    state.dispatchDialog = {
      ...createInitialDispatchDialogState(),
      open: true,
      workflow: action.payload,
      formValues: buildDispatchDefaults(action.payload),
    };
  },
  closeDispatchDialog(state: ActionManagementState) {
    state.dispatchDialog = createInitialDispatchDialogState();
  },
  setDispatchInput(state: ActionManagementState, action: PayloadAction<{ name: string; value: string }>) {
    state.dispatchDialog.formValues[action.payload.name] = action.payload.value;
  },
};

export function registerActionManagementExtraReducers(builder: ActionReducerMapBuilder<ActionManagementState>): void {
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
      state.transferModal.actionRecommendations = {};
      state.transferModal.workflowSearchQuery = '';
      state.transferModal.selectedAvailableWorkflowKeys = [];
      state.transferModal.selectedStagedWorkflowKeys = [];
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
      state.transferModal.actionRecommendations = action.payload.actionRecommendations;
      state.transferModal.selectedAvailableWorkflowKeys = [];
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
      state.transferModal.selectedAvailableWorkflowKeys = [];
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
      state.managedWorkflows = retainManagedWorkflows(state.managedWorkflows, action.payload.result.workflows);
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
      state.managedWorkflows = syncManagedWorkflowMonitoringState(state.managedWorkflows, action.payload.result.workflows);
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
      state.managedWorkflows = retainManagedWorkflows(state.managedWorkflows, action.payload.result.workflows);
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
}
