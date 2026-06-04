import { contextBridge, ipcRenderer } from 'electron';
import type { AppInfo, ExternalOpenResult } from '../shared/api.js';

const hagihubApi = {
  getAppInfo: () => ipcRenderer.invoke('hagihub:get-app-info') as Promise<AppInfo>,
  openExternal: (url: string) => ipcRenderer.invoke('hagihub:open-external', url) as Promise<ExternalOpenResult>,
};

contextBridge.exposeInMainWorld('hagihub', hagihubApi);

export type HagihubApi = typeof hagihubApi;
