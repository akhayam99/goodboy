import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useCurrentWorkspace, type SessionStudio } from '../../../../../store';
import { WorkflowBuilderView } from '../../../../workflows/components/WorkflowBuilderView';

const STUDIO_OUT_MS = 120;

type Props = {
  readonly session: Session;
  readonly studio: SessionStudio;
  readonly onClose: () => void;
};

export const SessionStudioLayer = ({ session, studio, onClose }: Props) => {
  const workspace = useCurrentWorkspace();
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const discardStaleCloseTimerForNewStudio = () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    setClosing(false);
  };
  useEffect(discardStaleCloseTimerForNewStudio, [studio.kind]);

  const clearPendingCloseTimerOnUnmount = () => () => {
    if (timer.current != null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(clearPendingCloseTimerOnUnmount, []);

  if (!workspace) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex flex-col bg-background',
        closing ? 'motion-safe:animate-layer-out' : 'motion-safe:animate-layer-in',
      )}
    >
      <div className="relative min-h-0 flex-1">
        <WorkflowBuilderView session={session} onClose={requestClose} />
      </div>
    </div>
  );
};
