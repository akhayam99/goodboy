import { createContext, useContext, type ReactNode } from 'react';

export const PaneActionsContext = createContext<ReactNode>(null);

export const useInheritedPaneActions = (): ReactNode => useContext(PaneActionsContext);
