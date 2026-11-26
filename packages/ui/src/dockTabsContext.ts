import { createContext } from 'react';

export type DockTabOption = {
  readonly value: string;
  readonly label: string;
};

type SelectParams = {
  readonly key: string;
};

type ClaimParams = {
  readonly paneKey: string;
};

export type DockTabs = {
  readonly paneKey: string;
  readonly options: ReadonlyArray<DockTabOption>;
  readonly shown: string;
  readonly onSelect: (params: SelectParams) => void;
  readonly claim: (params: ClaimParams) => () => void;
};

export const DockTabsContext = createContext<DockTabs | null>(null);
