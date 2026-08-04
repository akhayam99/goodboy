import { createContext, useContext } from 'react';

export const SessionSidebarCollapsedContext = createContext<boolean>(false);

export const useSessionSidebarCollapsed = (): boolean => useContext(SessionSidebarCollapsedContext);
