import { randomUUID } from 'node:crypto';
import { safeStorage } from 'electron';
import { fetchUser } from './github-api.js';
import { accountsStore, type GitHubAccountsData } from './storage/stores.js';
import type {
  DeviceFlowPollResult,
  DeviceFlowStartResult,
  GitHubAccount,
  GitHubAccountSummary,
  GitHubAccountsResult,
  GitHubTokenStorageMode,
} from '../shared/api.js';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const DEFAULT_GITHUB_CLIENT_ID = 'Ov23lifl4lJU94egKfAz';
const DEFAULT_GITHUB_OAUTH_SCOPE = 'repo,read:org';

interface ActiveDeviceFlow {
  flowId: string;
  deviceCode: string;
  intervalMs: number;
  expiresAt: number;
  abortController: AbortController;
  cancelled: boolean;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface AccessTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

function getGitHubClientId(): string {
  const clientId = process.env.HAGIHUB_GITHUB_CLIENT_ID?.trim();

  if (clientId) {
    return clientId;
  }

  return DEFAULT_GITHUB_CLIENT_ID;
}

function getGitHubOAuthScope(): string {
  const configuredScope = process.env.HAGIHUB_GITHUB_SCOPE
    ?.split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
    .join(',');

  if (configuredScope) {
    return configuredScope;
  }

  return DEFAULT_GITHUB_OAUTH_SCOPE;
}

function summarizeAccount(account: GitHubAccount): GitHubAccountSummary {
  return {
    id: account.id,
    login: account.login,
    avatarUrl: account.avatarUrl,
    addedAt: account.addedAt,
    name: account.name ?? null,
    storageMode: account.storageMode,
  };
}

function resolveStorageMode(): GitHubTokenStorageMode {
  if (safeStorage.isEncryptionAvailable()) {
    return 'encrypted';
  }

  safeStorage.setUsePlainTextEncryption(true);
  return 'plaintext';
}

function encryptToken(token: string): { encryptedToken: string; storageMode: GitHubTokenStorageMode } {
  const storageMode = resolveStorageMode();
  const encrypted = safeStorage.encryptString(token);

  return {
    encryptedToken: encrypted.toString('base64'),
    storageMode,
  };
}

function decryptToken(encryptedToken: string): string {
  return safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'));
}

function mapAccountsResult(store: GitHubAccountsData, recoveredCorruptedStorage = false): GitHubAccountsResult {
  return {
    accounts: store.accounts.map(summarizeAccount),
    activeAccountId: store.activeAccountId,
    recoveredCorruptedStorage,
  };
}

async function waitForNextPoll(intervalMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, intervalMs);

    const abortListener = () => {
      clearTimeout(timer);
      reject(new Error('Device flow polling cancelled.'));
    };

    signal.addEventListener('abort', abortListener, { once: true });
  });
}

async function requestDeviceCode(clientId: string): Promise<DeviceCodeResponse> {
  const scope = getGitHubOAuthScope();
  const response = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Hagihub',
    },
    body: new URLSearchParams({
      client_id: clientId,
      scope,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start GitHub device flow (${response.status}).`);
  }

  return await response.json() as DeviceCodeResponse;
}

async function requestAccessToken(clientId: string, deviceCode: string, signal: AbortSignal): Promise<AccessTokenResponse> {
  const response = await fetch(ACCESS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Hagihub',
    },
    body: new URLSearchParams({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to poll GitHub access token (${response.status}).`);
  }

  return await response.json() as AccessTokenResponse;
}

export const githubDeviceFlowEventChannel = 'hagihub:device-flow-update';

export function maskGitHubToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 4) {
    return '***';
  }

  return `***${trimmed.slice(-4)}`;
}

export class GitHubAuthManager {
  private activeFlow: ActiveDeviceFlow | null = null;

  constructor(private readonly emitDeviceFlowUpdate: (result: DeviceFlowPollResult) => void) {}

  async startDeviceFlow(): Promise<DeviceFlowStartResult> {
    if (this.activeFlow) {
      await this.cancelDeviceFlow();
    }

    const clientId = getGitHubClientId();
    const payload = await requestDeviceCode(clientId);
    const flowId = randomUUID();

    this.activeFlow = {
      flowId,
      deviceCode: payload.device_code,
      intervalMs: payload.interval * 1000,
      expiresAt: Date.now() + (payload.expires_in * 1000),
      abortController: new AbortController(),
      cancelled: false,
    };

    console.info('[github-auth] Device flow started', {
      flowId,
      expiresIn: payload.expires_in,
      interval: payload.interval,
    });

    void this.pollForToken(this.activeFlow, clientId);

    return {
      flowId,
      userCode: payload.user_code,
      verificationUri: payload.verification_uri,
      expiresIn: payload.expires_in,
      interval: payload.interval,
    };
  }

  async cancelDeviceFlow(): Promise<DeviceFlowPollResult> {
    if (!this.activeFlow) {
      return {
        flowId: '',
        status: 'cancelled',
      };
    }

    const flow = this.activeFlow;
    flow.cancelled = true;
    flow.abortController.abort();
    this.activeFlow = null;

    const result: DeviceFlowPollResult = {
      flowId: flow.flowId,
      status: 'cancelled',
    };

    this.emitDeviceFlowUpdate(result);
    console.info('[github-auth] Device flow cancelled', { flowId: flow.flowId });

    return result;
  }

  async removeAccount(accountId: string): Promise<GitHubAccountsResult> {
    const { data: store, source } = await accountsStore.read();
    const accounts = store.accounts.filter((account) => account.id !== accountId);
    const activeAccountId = store.activeAccountId === accountId ? accounts[0]?.id ?? null : store.activeAccountId;
    const nextStore: GitHubAccountsData = { accounts, activeAccountId };

    await accountsStore.write(nextStore);
    console.info('[github-auth] GitHub account removed', { accountId, activeAccountId });

    return mapAccountsResult(nextStore, source === 'default');
  }

  async getAccounts(): Promise<GitHubAccountsResult> {
    const { data: store, source } = await accountsStore.read();
    return mapAccountsResult(store, source === 'default');
  }

  async switchAccount(accountId: string): Promise<GitHubAccountsResult> {
    const { data: store, source } = await accountsStore.read();

    if (!store.accounts.some((account) => account.id === accountId)) {
      throw new Error('GitHub account not found.');
    }

    const nextStore: GitHubAccountsData = {
      ...store,
      activeAccountId: accountId,
    };

    await accountsStore.write(nextStore);
    console.info('[github-auth] Active GitHub account switched', { accountId });

    return mapAccountsResult(nextStore, source === 'default');
  }

  async getDecryptedToken(accountId: string): Promise<string> {
    const { data: store } = await accountsStore.read();
    const account = store.accounts.find((candidate) => candidate.id === accountId);

    if (!account) {
      throw new Error('GitHub account not found.');
    }

    const token = decryptToken(account.encryptedToken);
    console.info('[github-auth] Decrypted token for GitHub API call', {
      accountId,
      token: maskGitHubToken(token),
    });
    return token;
  }

  private finishDeviceFlow(flow: ActiveDeviceFlow, result: DeviceFlowPollResult): void {
    if (this.activeFlow?.flowId === flow.flowId) {
      this.activeFlow = null;
    }

    this.emitDeviceFlowUpdate(result);
  }

  private async saveAccountFromToken(token: string): Promise<GitHubAccountSummary> {
    const user = await fetchUser(token);
    const { data: store } = await accountsStore.read();
    const existingAccount = store.accounts.find((account) => account.login === user.login);
    const encrypted = encryptToken(token);
    const account: GitHubAccount = {
      id: existingAccount?.id ?? randomUUID(),
      login: user.login,
      avatarUrl: user.avatarUrl,
      encryptedToken: encrypted.encryptedToken,
      addedAt: existingAccount?.addedAt ?? new Date().toISOString(),
      name: user.name,
      storageMode: encrypted.storageMode,
    };

    const accounts = existingAccount
      ? store.accounts.map((candidate) => (candidate.id === existingAccount.id ? account : candidate))
      : [account, ...store.accounts];

    const nextStore: GitHubAccountsData = {
      accounts,
      activeAccountId: account.id,
    };

    await accountsStore.write(nextStore);
    console.info('[github-auth] GitHub account stored', {
      login: account.login,
      accountId: account.id,
      token: maskGitHubToken(token),
      storageMode: account.storageMode,
    });

    return summarizeAccount(account);
  }

  private async pollForToken(flow: ActiveDeviceFlow, clientId: string): Promise<void> {
    let nextIntervalMs = flow.intervalMs;

    while (this.activeFlow?.flowId === flow.flowId && !flow.cancelled) {
      if (Date.now() >= flow.expiresAt) {
        this.finishDeviceFlow(flow, {
          flowId: flow.flowId,
          status: 'expired',
          error: 'GitHub authorization expired before it was completed.',
        });
        return;
      }

      try {
        await waitForNextPoll(nextIntervalMs, flow.abortController.signal);
      } catch {
        if (flow.cancelled) {
          return;
        }
      }

      if (flow.cancelled || this.activeFlow?.flowId !== flow.flowId) {
        return;
      }

      try {
        const payload = await requestAccessToken(clientId, flow.deviceCode, flow.abortController.signal);

        if (payload.error === 'authorization_pending') {
          continue;
        }

        if (payload.error === 'slow_down') {
          nextIntervalMs += 5000;
          continue;
        }

        if (payload.error === 'expired_token') {
          this.finishDeviceFlow(flow, {
            flowId: flow.flowId,
            status: 'expired',
            error: 'GitHub authorization expired before it was completed.',
          });
          return;
        }

        if (payload.error || !payload.access_token) {
          this.finishDeviceFlow(flow, {
            flowId: flow.flowId,
            status: 'error',
            error: payload.error_description ?? payload.error ?? 'GitHub device flow failed.',
          });
          return;
        }

        const account = await this.saveAccountFromToken(payload.access_token);
        this.finishDeviceFlow(flow, {
          flowId: flow.flowId,
          status: 'success',
          account,
        });
        return;
      } catch (error) {
        if (flow.cancelled) {
          return;
        }

        this.finishDeviceFlow(flow, {
          flowId: flow.flowId,
          status: 'error',
          error: error instanceof Error ? error.message : 'GitHub device flow failed.',
        });
        return;
      }
    }
  }
}
