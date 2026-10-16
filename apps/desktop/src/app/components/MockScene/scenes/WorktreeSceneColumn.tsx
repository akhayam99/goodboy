import type { ReactNode } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { WorktreeLevel } from '../../SideColumn/WorktreeLevel';
import { WorktreeEntriesSlot } from './WorktreeEntriesSlot';

type Props = {
  readonly session?: Session;
  readonly children: ReactNode;
};

export const WorktreeSceneColumn = ({ session, children }: Props) => (
  <div className="flex h-full min-h-0 min-w-0">
    <aside
      aria-label="Worktree level"
      className="flex h-full w-60 shrink-0 flex-col border-r border-border-soft pt-3"
    >
      {session === undefined ? (
        <ScrollFade className="min-h-0 flex-1">
          <WorktreeEntriesSlot />
        </ScrollFade>
      ) : (
        <WorktreeLevel session={session} />
      )}
    </aside>
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</div>
  </div>
);
