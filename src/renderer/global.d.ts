import type { AppInfo, ExternalOpenResult } from '../shared/api';

interface HagihubApi {
  getAppInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => Promise<ExternalOpenResult>;
}

declare global {
  interface Window {
    hagihub: HagihubApi;
  }
}

export {};
