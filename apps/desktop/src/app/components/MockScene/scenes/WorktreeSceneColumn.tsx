import type { ReactNode } from 'react';
import type { Session } from '@goodboy/types';
import { SessionLevel } from '../../SessionRail/SessionLevel';
import { CommentDrawerColumn } from './CommentDrawerColumn';

type Props = {
  readonly session?: Session;
  readonly children: ReactNode;
};

export const WorktreeSceneColumn = ({ session, children }: Props) => (
  <div className="flex h-full min-h-0 min-w-0">
    {session === undefined ? null : (
      <aside
        aria-label="Worktree level"
        className="flex h-full w-60 shrink-0 flex-col border-r border-border-soft pt-3"
      >
        <SessionLevel session={session} isActive />
      </aside>
    )}
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    <CommentDrawerColumn />
  </div>
);
