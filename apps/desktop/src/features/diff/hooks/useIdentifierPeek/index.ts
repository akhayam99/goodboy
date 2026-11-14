import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type {
  IdentifierPeekConfig,
  PeekOpenParams,
} from '../../components/IdentifierPeek/PeekHost';

type Params = {
  readonly sessionId: SessionId;
  readonly worktreePath: string;
  readonly isCommitView: boolean;
};

export const useIdentifierPeek = ({
  sessionId,
  worktreePath,
  isCommitView,
}: Params): IdentifierPeekConfig | null => {
  const openDrawer = useAppStore((s) => s.openDrawer);
  return useMemo(
    () =>
      isCommitView
        ? null
        : {
            worktreePath,
            onOpen: ({ word, match }: PeekOpenParams) =>
              openDrawer({
                kind: 'identifier-peek',
                sessionId,
                payload: { worktreePath, word, selected: { path: match.path, line: match.line } },
              }),
          },
    [isCommitView, openDrawer, sessionId, worktreePath],
  );
};
