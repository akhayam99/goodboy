import { createContext, useContext } from 'react';

const PopoverPortalContext = createContext<Element | null>(null);

export const PopoverPortalProvider = PopoverPortalContext.Provider;

export const usePopoverPortalTarget = (): Element | null => useContext(PopoverPortalContext);
