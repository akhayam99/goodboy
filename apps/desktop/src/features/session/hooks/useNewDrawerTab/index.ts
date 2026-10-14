import { useCallback, useState } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import type { NewDrawerTab } from '../../../../store/slices/drawer/state';
import { readLastNewTab, writeLastNewTab } from '../../newDrawerTab';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly requested: NewDrawerTab | null;
};

type ChooseParams = {
  readonly tab: NewDrawerTab;
};

export const useNewDrawerTab = ({ workspaceId, requested }: Params) => {
  const [tab, setTab] = useState<NewDrawerTab>(() => requested ?? readLastNewTab({ workspaceId }));
  const choose = useCallback(
    ({ tab: next }: ChooseParams): void => {
      setTab(next);
      writeLastNewTab({ workspaceId, tab: next });
    },
    [workspaceId],
  );
  return { tab, choose };
};
