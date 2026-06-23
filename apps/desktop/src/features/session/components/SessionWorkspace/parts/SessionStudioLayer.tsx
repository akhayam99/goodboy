import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useCurrentWorkspace, type SessionStudio } from '../../../../../store';
import { WorkflowBuilderView } from '../../WorkflowBuilderView';
import { GitHubSessionPane } from '../../../../github/components/GitHubSessionPane';
import { MrSessionPane } from '../../../../integrations/gitlab/MrSessionPane';

const STUDIO_OUT_MS = 200;

type Props = {
  readonly session: Session;
  readonly studio: SessionStudio;
  readonly onClose: () => void;
};

export const SessionStudioLayer = ({ session, studio, onClose }: Props) => {
  const workspace = useCurrentWorkspace();
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Defer the real unmount one studio-out cycle so the exit can play; reduced-motion
  // skips the animation, so fall straight through to onClose without a visible hold.
  const requestClose = useCallback(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      onClose();
      return;
    }
    setClosing(true);
    timer.current = setTimeout(onClose, STUDIO_OUT_MS);
  }, [onClose]);

  // The store swaps sessionStudio[sid] in place (no remount/key), so a close
  // animation in flight for the previous studio would otherwise leave its
  // pending onClose timer to fire — closing the freshly-opened pane. On any
  // studio identity change, abort the pending close and reset to the in state.
  const studioPrNumber = studio.kind === 'github' ? studio.prNumber : undefined;
  const studioThreadId = studio.kind === 'github' ? studio.threadId : undefined;
  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setClosing(false);
  }, [studio.kind, studioPrNumber, studioThreadId]);

  // Clear any pending close timer on unmount so a leaked timer can't fire
  // onClose after this layer is gone.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    },
    [],
  );

  if (!workspace) {
    return null;
  }
  const workspaceName = workspace.name;
  return (
    <div
      className={cn(
        'absolute inset-0 z-20 bg-background',
        closing ? 'motion-safe:animate-studio-out' : 'motion-safe:animate-studio-in',
      )}
    >
      {studio.kind === 'workflow' ? (
        <WorkflowBuilderView session={session} onClose={requestClose} />
      ) : studio.kind === 'github' ? (
        <GitHubSessionPane
          sessionId={session.id}
          workspaceName={workspaceName}
          initialPrNumber={studio.prNumber ?? null}
          initialThreadId={studio.threadId ?? null}
          onClose={requestClose}
        />
      ) : (
        <MrSessionPane
          sessionId={session.id}
          workspaceName={workspaceName}
          onClose={requestClose}
        />
      )}
    </div>
  );
};
