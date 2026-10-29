import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { BranchTab } from '../../../../store/slices/navigation/types';

type Params = {
  readonly sessionId: SessionId;
  readonly onSelectTab: (tab: BranchTab) => void;
};

export const useOpenBranchFolder = ({ sessionId, onSelectTab }: Params) => {
  const setBranchFilesFolder = useAppStore((s) => s.setBranchFilesFolder);
  return useCallback(
    (folder: string): void => {
      setBranchFilesFolder({ sessionId, folder });
      onSelectTab('files');
    },
    [onSelectTab, sessionId, setBranchFilesFolder],
  );
};
