import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import hubReducer from './slices/hubSlice';
import navigationReducer from './slices/navigationSlice';

export const store = configureStore({
  reducer: {
    hub: hubReducer,
    navigation: navigationReducer,
  },
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
