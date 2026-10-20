import type { ReactNode } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SessionLevel } from '../../SessionRail/SessionLevel';
import { CommentDrawerColumn } from './CommentDrawerColumn';
import { SceneBranchTabs } from './SceneBranchTabs';

type Props = {
  readonly session?: Session;
  readonly children: ReactNode;
};

export const WorktreeSceneColumn = ({ session, children }: Props) => {
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  return (
    <div className="flex h-full min-h-0 min-w-0">
      <aside
        aria-label="Worktree level"
        className="flex h-full w-60 shrink-0 flex-col border-r border-border-soft pt-3"
      >
        {session !== undefined ? (
          <SessionLevel session={session} isActive />
        ) : (
          <ScrollFade className="min-h-0 flex-1">
            {currentSessionId === null ? null : <SceneBranchTabs sessionId={currentSessionId} />}
          </ScrollFade>
        )}
      </aside>
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      <CommentDrawerColumn />
    </div>
  );
};
