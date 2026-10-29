import { useCallback } from 'react';
import type { DiffView, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { BranchTab } from '../../../../store/slices/navigation/types';
import { useBranchDiff } from '../../branchDiffContext';

type Params = {
  readonly sessionId: SessionId;
  readonly onSelectTab: (tab: BranchTab) => void;
};

const BRANCH_VIEW: DiffView = { kind: 'branch' };

export const useOpenBranchFolder = ({ sessionId, onSelectTab }: Params) => {
  const setBranchFilesFolder = useAppStore((s) => s.setBranchFilesFolder);
  const setDiffFocus = useAppStore((s) => s.setDiffFocus);
  const diff = useBranchDiff();
  return useCallback(
    (folder: string): void => {
      if (diff !== null) {
        if (diff.view.kind !== 'branch') {
          diff.setView(BRANCH_VIEW);
        }
        diff.clearFocus();
      }
      if ((useAppStore.getState().diffFocus[sessionId] ?? null) !== null) {
        setDiffFocus(sessionId, null);
      }
      setBranchFilesFolder({ sessionId, folder });
      onSelectTab('files');
    },
    [diff, onSelectTab, sessionId, setBranchFilesFolder, setDiffFocus],
  );
};
