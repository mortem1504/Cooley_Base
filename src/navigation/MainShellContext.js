import React, { createContext, useContext } from 'react';

const MainShellContext = createContext(null);
const FALLBACK_CONTEXT = {
  activeDiscoverSectionKey: 'suggested',
  activeNestedRouteName: '',
  activeTabRouteName: '',
  closeSidebar: () => {},
  discoverSectionJumpRequest: { key: null, nonce: 0 },
  isShellAvailable: false,
  openSidebar: () => {},
  setActiveDiscoverSectionKey: () => {},
  toggleSidebar: () => {},
};

export function MainShellProvider({ children, value }) {
  return <MainShellContext.Provider value={value}>{children}</MainShellContext.Provider>;
}

export function useMainShell() {
  const context = useContext(MainShellContext);

  return context || FALLBACK_CONTEXT;
}
