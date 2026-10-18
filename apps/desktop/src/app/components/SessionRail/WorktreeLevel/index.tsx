import { useCallback, useRef } from 'react';
import { ScrollFade } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useActionControls } from '../../../../features/actions/useActionControls';
import { worktreeLevelSlot } from '../../../../features/branch/worktreeLevelSlot';
import { useRebaseJob } from '../../../../features/history/useRebaseJob';
import { RebaseConflictPrompt } from '../../../../features/history/components/RebaseConflictPrompt';
import { WorktreeIdentityRow } from './WorktreeIdentityRow';
import { WorktreeStatusLine } from './WorktreeStatusLine';
import { useWorktreeTarget } from './useWorktreeTarget';

type Props = {
  readonly session: Session;
};

export const WorktreeLevel = ({ session }: Props) => {
  const worktree = useWorktreeTarget({ sessionId: session.id });
  const controls = useActionControls({ target: worktree.target });
  const rebase = useRebaseJob({ sessionId: session.id, worktreePath: worktree.mountPath });
  const hostRef = useRef<HTMLElement | null>(null);
  const attachHost = useCallback((node: HTMLDivElement | null) => {
    if (node === null) {
      if (hostRef.current !== null) {
        worktreeLevelSlot.detach({ host: hostRef.current });
      }
      hostRef.current = null;
      return;
    }
    hostRef.current = node;
    worktreeLevelSlot.attach({ host: node });
  }, []);

  return (
    <div data-worktree-level="" className="flex min-h-0 flex-1 flex-col gap-1">
      {worktree.mount === null || worktree.mountPath === null ? null : (
        <div className="flex shrink-0 flex-col px-2">
          <WorktreeIdentityRow
            sessionId={session.id}
            mount={worktree.mount}
            mountPath={worktree.mountPath}
            projectName={worktree.projectName}
            target={worktree.target}
          />
          <WorktreeStatusLine
            status={worktree.status}
            baseBranch={worktree.baseBranch}
            job={rebase?.job ?? null}
            controls={controls}
          />
        </div>
      )}
      {rebase?.job.state === 'conflict' ? (
        <div data-rebase-conflict="" className="flex shrink-0 flex-col px-2">
          <RebaseConflictPrompt sessionId={session.id} worktreePath={worktree.mountPath} />
        </div>
      ) : null}
      <ScrollFade className="min-h-0 flex-1">
        <div
          ref={attachHost}
          data-slot="worktree-level-entries"
          className="flex min-h-0 flex-col pb-2"
        />
      </ScrollFade>
    </div>
  );
};
