import type {
  GitHubManagedWorkflow,
  GitHubManagedWorkflowReference,
  GitHubWorkflowSummary,
} from '../../../shared/api';

export type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';
export type TransferPhase = 1 | 2 | 3;

export const GLOBAL_TRANSFER_LOAD_ERROR_KEY = '__global__';

export interface DispatchDialogState {
  open: boolean;
  workflow: GitHubManagedWorkflow | null;
  formValues: Record<string, string>;
  submitStatus: FetchStatus;
  error: string | null;
  successMessage: string | null;
}

export interface TransferLoadProgress {
  current: number;
  total: number;
}

export interface TransferModalState {
  open: boolean;
  phase: TransferPhase;
  selectedRepoFullNames: string[];
  selectedOwnerKey: string | null;
  repoSearchQuery: string;
  candidateWorkflows: GitHubWorkflowSummary[];
  stagedSelection: GitHubManagedWorkflowReference[];
  workflowSearchQuery: string;
  selectedAvailableWorkflowKeys: string[];
  selectedStagedWorkflowKeys: string[];
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

export function workflowKey(
  workflow: Pick<GitHubManagedWorkflowReference, 'repoFullName' | 'workflowId'>,
): string {
  return `${workflow.repoFullName}#${workflow.workflowId}`;
}

export function getMonitoredManagedWorkflowReferences(
  workflows: GitHubManagedWorkflowReference[],
): GitHubManagedWorkflowReference[] {
  return workflows.filter((workflow) => workflow.monitored === true);
}

export function toWorkflowReference(
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

export function buildDispatchDefaults(workflow: GitHubManagedWorkflow): Record<string, string> {
  return Object.fromEntries(
    workflow.dispatchInputs.map((input) => [input.name, input.defaultValue ?? '']),
  );
}

export function dedupeWorkflowReferences(
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

export function dedupeWorkflowSummaries(workflows: GitHubWorkflowSummary[]): GitHubWorkflowSummary[] {
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

export function createInitialDispatchDialogState(): DispatchDialogState {
  return {
    open: false,
    workflow: null,
    formValues: {},
    submitStatus: 'idle',
    error: null,
    successMessage: null,
  };
}

export function createInitialTransferModalState(): TransferModalState {
  return {
    open: false,
    phase: 1,
    selectedRepoFullNames: [],
    selectedOwnerKey: null,
    repoSearchQuery: '',
    candidateWorkflows: [],
    stagedSelection: [],
    workflowSearchQuery: '',
    selectedAvailableWorkflowKeys: [],
    selectedStagedWorkflowKeys: [],
    loadProgress: {
      current: 0,
      total: 0,
    },
    loadErrors: {},
    saveStatus: 'idle',
    saveError: null,
  };
}

export function createInitialActionManagementState(): ActionManagementState {
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
    dispatchDialog: createInitialDispatchDialogState(),
    transferModal: createInitialTransferModalState(),
  };
}
