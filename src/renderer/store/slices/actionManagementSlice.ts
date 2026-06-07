import { createSlice } from '@reduxjs/toolkit';
import { createInitialActionManagementState } from '@/features/action-management/model';
import {
  actionManagementReducers,
  registerActionManagementExtraReducers,
} from './actionManagementReducers';

const actionManagementSlice = createSlice({
  name: 'actionManagement',
  initialState: createInitialActionManagementState(),
  reducers: actionManagementReducers,
  extraReducers: (builder) => {
    registerActionManagementExtraReducers(builder);
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
  setTransferAvailableWorkflowBatchSelection,
  setTransferRepoBatchSelection,
  setTransferRepoSearchQuery,
  setTransferSelectedOwnerKey,
  setTransferWorkflowSearchQuery,
  toggleRepoSelection,
  toggleTransferAvailableWorkflowKey,
  toggleTransferStagedWorkflowKey,
} = actionManagementSlice.actions;

export {
  addManagedWorkflow,
  batchSaveManagedWorkflows,
  dispatchManagedWorkflow,
  loadManagedWorkflows,
  loadManagedWorkflowsForActiveAccount,
  loadMultiRepoWorkflows,
  refreshManagedWorkflows,
  refreshManagedWorkflowsForActiveAccount,
  refreshMonitoredWorkflowsForActiveAccount,
  removeManagedWorkflow,
  removeManagedWorkflowForActiveAccount,
  submitDispatchDialog,
  toggleMonitoring,
  toggleMonitoringForActiveAccount,
} from './actionManagementThunks';

export default actionManagementSlice.reducer;
