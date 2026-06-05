import type { GitHubManagedWorkflowReference, GitHubTokenStorageMode } from '../../shared/api.js';
import type { StoreDefinition } from '../../shared/storage.js';
import { createStoreHandle } from './index.js';

export interface GitHubAccountsData {
  accounts: Array<{
    id: string;
    login: string;
    avatarUrl: string;
    encryptedToken: string;
    addedAt: string;
    name?: string | null;
    storageMode?: GitHubTokenStorageMode;
  }>;
  activeAccountId: string | null;
}

export interface RepoCacheData {
  repos: Array<{
    id: number;
    fullName: string;
    updatedAt: string;
    [key: string]: unknown;
  }>;
  lastFetchedAt: string | null;
}

export interface RuntimeStateData {
  lastActiveAccountId: string | null;
  windowBounds: { width: number; height: number; x?: number; y?: number } | null;
  sidebarWidth: number | null;
  lastView: string | null;
}

export interface ManagedActionsData {
  accounts: Array<{
    accountId: string;
    workflows: GitHubManagedWorkflowReference[];
  }>;
}

function isManagedWorkflowReference(data: unknown): data is GitHubManagedWorkflowReference {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const item = data as Record<string, unknown>;
  return typeof item.accountId === 'string'
    && typeof item.repoFullName === 'string'
    && typeof item.repoHtmlUrl === 'string'
    && (typeof item.defaultBranch === 'string' || item.defaultBranch === null)
    && typeof item.workflowId === 'number'
    && typeof item.workflowName === 'string'
    && typeof item.workflowPath === 'string'
    && typeof item.workflowHtmlUrl === 'string'
    && typeof item.supportsDispatch === 'boolean';
}

export const accountsStore = createStoreHandle<GitHubAccountsData>({
  key: 'accounts',
  fileName: 'github-accounts.json',
  version: 1,
  defaultData: {
    accounts: [],
    activeAccountId: null,
  },
  validate: (data): data is GitHubAccountsData => {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    return Array.isArray(d.accounts) && ('activeAccountId' in d);
  },
});

export const repoCacheStore = createStoreHandle<RepoCacheData>({
  key: 'repo-cache',
  fileName: 'repo-cache.json',
  version: 1,
  defaultData: {
    repos: [],
    lastFetchedAt: null,
  },
  validate: (data): data is RepoCacheData => {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    return Array.isArray(d.repos);
  },
});

export const runtimeStateStore = createStoreHandle<RuntimeStateData>({
  key: 'runtime-state',
  fileName: 'runtime-state.json',
  version: 1,
  defaultData: {
    lastActiveAccountId: null,
    windowBounds: null,
    sidebarWidth: null,
    lastView: null,
  },
  validate: (data): data is RuntimeStateData => {
    if (typeof data !== 'object' || data === null) return false;
    return true;
  },
});

export const managedActionsStore = createStoreHandle<ManagedActionsData>({
  key: 'managed-actions',
  fileName: 'managed-actions.json',
  version: 1,
  defaultData: {
    accounts: [],
  },
  validate: (data): data is ManagedActionsData => {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const candidate = data as Record<string, unknown>;
    if (!Array.isArray(candidate.accounts)) {
      return false;
    }

    return candidate.accounts.every((account) => {
      if (typeof account !== 'object' || account === null) {
        return false;
      }

      const record = account as Record<string, unknown>;
      return typeof record.accountId === 'string'
        && Array.isArray(record.workflows)
        && record.workflows.every(isManagedWorkflowReference);
    });
  },
});
