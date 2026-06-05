export interface StoreDefinition<T = unknown> {
  key: string;
  fileName: string;
  version: number;
  defaultData: T;
  validate?: (data: unknown) => boolean;
  migrate?: (fromVersion: number, data: unknown) => T;
}

export interface JsonEnvelope<T = unknown> {
  version: number;
  updatedAt: string;
  data: T;
}

export type BootstrapStoreStatus = 'initialized' | 'migrated' | 'default-restored' | 'corrupt-recovered' | 'unchanged';

export interface BootstrapStoreResult {
  key: string;
  status: BootstrapStoreStatus;
  backupPath?: string;
  error?: string;
}

export interface BootstrapReport {
  results: BootstrapStoreResult[];
  success: boolean;
}

export type ReadSource = 'file' | 'default' | 'migrated';

export interface ReadResult<T = unknown> {
  data: T;
  source: ReadSource;
  version: number;
}
