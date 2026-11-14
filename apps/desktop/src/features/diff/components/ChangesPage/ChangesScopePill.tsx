import { useCallback } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { ExploreProjectChip } from '../../FilesMode/ExploreProjectChip';
import { useExploreRoot } from '../../FilesMode/useExploreRoot';

type PickParams = {
  readonly mountPath: string | null;
};

type Props = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
};

export const ChangesScopePill = ({ sessionId, worktreePath }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const isPicker = useAppStore((state) => state.activeLens?.[sessionId] === 'files');
  const onPick = useCallback(
    ({ mountPath }: PickParams) => {
      if (mountPath === null || mountPath === worktreePath) {
        return;
      }
      navigate({
        to: sessionPlace({
          sessionId,
          lens: 'files',
          target: { kind: 'diff', mountPath, focus: null },
        }),
        mode: 'replace',
      });
    },
    [navigate, sessionId, worktreePath],
  );
  const root = useExploreRoot({ sessionId, pinnedPath: worktreePath, onPick });
  return (
    <ExploreProjectChip
      target={root.target}
      groups={root.groups}
      rowCount={isPicker ? root.rowCount : 1}
    />
  );
};
