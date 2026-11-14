import type { ReactNode } from 'react';
import { UnderTrailContext } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { SessionLevel } from '../../SessionRail/SessionLevel';
import { SessionHead } from '../../SessionHead';
import { CommentDrawerColumn } from './CommentDrawerColumn';

type Props = {
  readonly session?: Session;
  readonly headSession?: Session;
  readonly children: ReactNode;
};

export const WorktreeSceneColumn = ({ session, headSession, children }: Props) => (
  <div className="flex h-full min-h-0 min-w-0">
    {session === undefined ? null : (
      <aside
        aria-label="Worktree level"
        className="flex h-full w-60 shrink-0 flex-col border-r border-border-soft pt-3"
      >
        <SessionLevel session={session} isActive />
      </aside>
    )}
    {headSession === undefined ? (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    ) : (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-2">
        <SessionHead session={headSession} />
        <UnderTrailContext.Provider value>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </UnderTrailContext.Provider>
      </div>
    )}
    <CommentDrawerColumn />
  </div>
);
