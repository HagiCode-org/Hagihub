import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type NavigationSection = 'overview' | 'repos' | 'actions' | 'accounts' | 'settings';

interface NavigationState {
  activeSection: NavigationSection;
  sidebarCollapsed: boolean;
}

const initialState: NavigationState = {
  activeSection: 'overview',
  sidebarCollapsed: false,
};

const navigationSlice = createSlice({
  name: 'navigation',
  initialState,
  reducers: {
    setActiveSection(state, action: PayloadAction<NavigationSection>) {
      state.activeSection = action.payload;
    },
    toggleSidebarCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { setActiveSection, toggleSidebarCollapsed } = navigationSlice.actions;

export default navigationSlice.reducer;
