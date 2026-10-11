import { createContext, useContext, type ReactNode } from 'react';

export const StudioBandContext = createContext<ReactNode>(null);

export const useStudioBand = (): ReactNode => useContext(StudioBandContext);
