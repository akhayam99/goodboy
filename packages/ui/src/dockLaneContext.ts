import { createContext } from 'react';

export const DockLaneContext = createContext<((node: HTMLElement | null) => void) | null>(null);
