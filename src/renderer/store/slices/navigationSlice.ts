import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NavigationSection = 'overview' | 'repos' | 'accounts' | 'settings';

interface NavigationState {
  activeSection: NavigationSection;
}

const initialState: NavigationState = {
  activeSection: 'overview',
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setActiveSection(state, action: PayloadAction<NavigationSection>) {
      state.activeSection = action.payload;
    },
  },
});

export const { setActiveSection } = navigationSlice.actions;

export default navigationSlice.reducer;
