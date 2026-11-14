import type { ReactNode } from 'react';
import { PaneActionsContext } from './paneActionsContext';
import { PaneTabsContext } from './paneTabsContext';

type Props = {
  readonly children: ReactNode;
};

export const OwnPaneChrome = ({ children }: Props) => (
  <PaneTabsContext.Provider value={null}>
    <PaneActionsContext.Provider value={null}>{children}</PaneActionsContext.Provider>
  </PaneTabsContext.Provider>
);
