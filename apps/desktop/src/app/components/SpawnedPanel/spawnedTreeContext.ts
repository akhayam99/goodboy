import { createContext } from 'react';

export type SpawnedTreeFocus = Readonly<{
  activeId: string | null;
  setActiveId: (id: string) => void;
}>;

export const SpawnedTreeContext = createContext<SpawnedTreeFocus>({
  activeId: null,
  setActiveId: () => undefined,
});
