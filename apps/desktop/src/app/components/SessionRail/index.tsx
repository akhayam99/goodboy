import { useMemo, type KeyboardEvent } from 'react';
import {
  COLLAPSED_RAIL_WIDTH,
  FoldLayers,
  LEFT_SIDEBAR_DEFAULT,
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  PANE_RHYTHM,
  ResizeHandle,
  cn,
  useInnerColumn,
  useResizableWidth,
} from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { STORAGE_KEYS } from '../../../shared/lib/storage-keys';
import { openLens } from '../../../features/session/openLens';
import { ActionStatusLine } from '../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ObjectTarget } from '../../../features/actions/types';
import { useActionControls } from '../../../features/actions/useActionControls';
import { useColumnPlace } from '../../hooks/useColumnPlace';
import { useShellFolds } from '../../hooks/useShellFolds';
import { SessionLevelActions } from './SessionLevel/SessionLevelActions';
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
  const folds = useShellFolds();
  const fold = useSessionRailFold({ isNarrow: folds.isRailNarrow });
  const level = useSessionRailLevel({ sessionId, isFolded: fold.isFolded });
  const resizable = useResizableWidth<HTMLElement>({
    storageKey: STORAGE_KEYS.sessionRailWidth,
    defaultWidth: LEFT_SIDEBAR_DEFAULT,
    min: LEFT_SIDEBAR_MIN,
    max: LEFT_SIDEBAR_MAX,
    cssVar: WIDTH_VAR,
  });
  const isStudioOver = place !== null;
  useInnerColumn({
    id: 'session-rail',
    label: fold.isFolded ? 'Show the session rail' : 'Fold the session rail',
    toggle: fold.toggle,
    isActive: !isStudioOver,
  });
  const target = useMemo<ObjectTarget>(() => ({ kind: 'session', sessionId }), [sessionId]);
  const controls = useActionControls({ target, scopeKey: sessionId });
  const isSessionChrome = level === 'session' && !fold.isFolded;
  const isTopFailure = controls.failure !== null;
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
        openLens({ sessionId, lens: null });
      }}
      style={{
        ...resizable.style,
        width: fold.isFolded ? COLLAPSED_RAIL_WIDTH : `var(${WIDTH_VAR})`,
      }}
      className={cn(
        'relative flex h-full min-h-0 shrink-0 flex-col gap-1 bg-background pb-2',
        'motion-safe:transition-[width] motion-safe:duration-220 motion-safe:ease-out',
      )}
    >
      <div data-rail-top="" className={cn('flex min-w-0 shrink-0 pr-2', PANE_RHYTHM.headerInset)}>
        <div
          data-header-line=""
          className={cn('flex min-w-0 flex-1 items-center justify-between', PANE_RHYTHM.headerRow)}
        >
          <div className="flex w-11 shrink-0 items-center justify-center">
            <SessionRailToggle isFolded={fold.isFolded} onToggle={fold.toggle} />
          </div>
          {isSessionChrome ? <SessionLevelActions session={session} controls={controls} /> : null}
        </div>
      </div>
      {isSessionChrome && isTopFailure ? (
        <div className="shrink-0 px-2">
          <ActionStatusLine controls={controls} showReasons={false} />
        </div>
      ) : null}
      <FoldLayers
        isFolded={fold.isFolded}
        openWidth={`var(${WIDTH_VAR})`}
        open={
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <SessionRailLevels session={session} level={level} isStudioOver={isStudioOver} />
          </div>
        }
        folded={
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <SessionRailIcons session={session} level={level} />
          </div>
        }
      />
      {fold.isFolded ? null : (
        <div className="absolute inset-y-0 -right-1 z-10 flex">
          <ResizeHandle {...resizable.handleProps} ariaLabel="Resize session rail" drawsEdge />
        </div>
      )}
    </nav>
  );
};
