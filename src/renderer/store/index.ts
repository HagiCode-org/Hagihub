import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { listenerMiddleware } from './listenerMiddleware';
import { registerStoreListeners } from './listeners';
import hubReducer from './slices/hubSlice';
import navigationReducer from './slices/navigationSlice';
import actionManagementReducer from './slices/actionManagementSlice';
import githubAccountsReducer from './slices/githubAccountsSlice';
import githubActionsReducer from './slices/githubActionsSlice';
import githubReposReducer from './slices/githubReposSlice';
import repoWorkspacesReducer from './slices/repoWorkspaceSlice';

export const store = configureStore({
  reducer: {
    hub: hubReducer,
    navigation: navigationReducer,
    actionManagement: actionManagementReducer,
    githubAccounts: githubAccountsReducer,
    githubActions: githubActionsReducer,
    githubRepos: githubReposReducer,
    repoWorkspaces: repoWorkspacesReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().prepend(listenerMiddleware.middleware),
  devTools: import.meta.env.DEV,
});

registerStoreListeners();

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
