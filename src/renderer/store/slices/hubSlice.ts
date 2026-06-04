import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import i18n from '@/locales';
import type { AppInfo } from '../../../shared/api';

type LoadStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface HubState {
  appInfo: AppInfo | null;
  loadStatus: LoadStatus;
  loadError: string | null;
}

const initialState: HubState = {
  appInfo: null,
  loadStatus: 'idle',
  loadError: null,
};

export const fetchAppInfo = createAsyncThunk<AppInfo, void, { rejectValue: string }>(
  'hub/fetchAppInfo',
  async (_, { rejectWithValue }) => {
    try {
      return await window.hagihub.getAppInfo();
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : i18n.t('appInfoLoadFailed', { ns: 'error' }),
      );
    }
  },
);

const hubSlice = createSlice({
  name: 'hub',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAppInfo.pending, (state) => {
        state.loadStatus = 'loading';
        state.loadError = null;
      })
      .addCase(fetchAppInfo.fulfilled, (state, action) => {
        state.appInfo = action.payload;
        state.loadStatus = 'succeeded';
      })
      .addCase(fetchAppInfo.rejected, (state, action) => {
        state.loadStatus = 'failed';
        state.loadError = action.payload ?? i18n.t('appInfoLoadFailed', { ns: 'error' });
      });
  },
});

export default hubSlice.reducer;
