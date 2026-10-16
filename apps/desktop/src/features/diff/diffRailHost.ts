import { createContext } from 'react';

export type DiffRailHost = {
  readonly slot: HTMLElement | null;
  readonly page: HTMLElement | null;
};

export const DiffRailContext = createContext<DiffRailHost>({ slot: null, page: null });
