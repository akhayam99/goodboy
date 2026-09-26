import { createContext } from 'react';

export type ScrollerStyle = 'hover' | 'always';

export const ScrollerStyleContext = createContext<ScrollerStyle>('hover');
