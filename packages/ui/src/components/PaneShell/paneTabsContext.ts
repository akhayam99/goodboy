import { createContext, useContext, type ReactNode } from 'react';

export const PaneTabsContext = createContext<ReactNode>(null);

export const useInheritedPaneTabs = (): ReactNode => useContext(PaneTabsContext);
