import type { KeyboardEvent } from 'react';
import {
  COLLAPSED_RAIL_WIDTH,
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  ResizeHandle,
  cn,
  useResizableWidth,
} from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore } from '../../../store';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { openLens } from '../../../features/session/openLens';
import { SessionTools } from '../../../features/session/components/SessionTools';
import { leaveRunLevel } from '../../../features/workflows/leaveRunLevel';
import { useColumnPlace } from '../../hooks/useColumnPlace';
import { useShellFolds } from '../../hooks/useShellFolds';
import { SessionRailIcons } from './SessionRailIcons';
import { SessionRailLevels } from './SessionRailLevels';
import { SessionRailToggle } from './SessionRailToggle';
import { useSessionRailFold } from './useSessionRailFold';
import { useSessionRailLevel } from './useSessionRailLevel';

type Props = {
  readonly session: Session;
};

const WIDTH_VAR = '--goodboy-session-rail-width';

const isBackKey = (event: KeyboardEvent): boolean =>
  event.key === '[' && event.metaKey && !event.shiftKey && !event.altKey && !event.ctrlKey;

export const SessionRail = ({ session }: Props) => {
  const sessionId = session.id;
  const place = useColumnPlace();
  const level = useSessionRailLevel({ sessionId });
  const folds = useShellFolds();
  const fold = useSessionRailFold({ isNarrow: folds.isRailNarrow });
  const pickRailLevel = useAppStore((state) => state.pickRailLevel);
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: STORAGE_KEYS.sessionRailWidth,
    defaultWidth: LEFT_SIDEBAR_DEFAULT,
    min: LEFT_SIDEBAR_MIN,
    max: LEFT_SIDEBAR_MAX,
    cssVar: WIDTH_VAR,
  });
  const isStudioOver = place !== null;
  const goBack = () => {
    if (level === 'run') {
      leaveRunLevel({ sessionId });
      return;
    }
    if (level === 'worktree') {
      openLens({ sessionId, lens: null });
      return;
    }
    if (level === 'auto') {
      pickRailLevel({ level: 'session' });
    }
  };
  return (
    <nav
      ref={resizable.targetRef}
      aria-label="Session"
      data-session-rail={level}
      data-rail-folded={fold.isFolded ? '' : undefined}
      onKeyDown={(event) => {
        if (level === 'session' || !isBackKey(event)) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        goBack();
      }}
      style={{
        ...resizable.style,
        width: fold.isFolded ? COLLAPSED_RAIL_WIDTH : `var(${WIDTH_VAR})`,
      }}
      className={cn(
        'relative flex h-full min-h-0 shrink-0 flex-col gap-1 bg-background pb-2 pt-1',
        'motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out',
        fold.isFolded && 'items-center',
      )}
    >
      <div className="flex w-11 shrink-0 items-center justify-center">
        <SessionRailToggle isFolded={fold.isFolded} onToggle={fold.toggle} />
      </div>
      {fold.isFolded ? (
        <>
          <div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden">
            <SessionRailIcons session={session} level={level} />
          </div>
          <SessionTools sessionId={sessionId} isFolded />
        </>
      ) : (
        <>
          <SessionRailLevels session={session} level={level} isStudioOver={isStudioOver} />
          <SessionTools sessionId={sessionId} isFolded={false} />
          <div className="absolute inset-y-0 -right-1 z-10 flex">
            <ResizeHandle {...resizable.handleProps} ariaLabel="Resize session rail" drawsEdge />
          </div>
        </>
      )}
    </nav>
  );
};
