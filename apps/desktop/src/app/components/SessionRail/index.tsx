import { SESSION_TOOL_RAIL_WIDTH } from '../../../features/session/components/SessionTools/sessionToolRailWidth';
import { useMemo } from 'react';
import { RotateCw } from 'lucide-react';
import {
  COLLAPSED_RAIL_WIDTH,
  FoldLayers,
  IconButton,
  PANE_RHYTHM,
  ResizeHandle,
  cn,
  useInnerColumn,
  useDrawerContentInset,
} from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { ActionStatusLine } from '../../../features/actions/components/ActionControls/ActionStatusLine';
import type { ObjectTarget } from '../../../features/actions/types';
import { useActionControls } from '../../../features/actions/useActionControls';
import { useColumnPlace } from '../../hooks/useColumnPlace';
import { SessionLevelActions } from './SessionLevel/SessionLevelActions';
import { SessionRailIcons } from './SessionRailIcons';
import { SessionRailLevels } from './SessionRailLevels';
import { SessionRailToggle } from './SessionRailToggle';
import { useUnfoldForLink } from './useUnfoldForLink';
import {
  SESSION_RAIL_WIDTH_VAR,
  useSessionRailSizing,
  type SessionRailSizing,
} from './useSessionRailSizing';

type Props = {
  readonly session: Session;
  readonly sizing?: SessionRailSizing;
};

export const SessionRail = ({ session, sizing }: Props) => {
  const sessionId = session.id;
  const place = useColumnPlace();
  const localSizing = useSessionRailSizing();
  const { resizable, fold } = sizing ?? localSizing;
  useDrawerContentInset({
    width: (fold.isFolded ? COLLAPSED_RAIL_WIDTH : resizable.width) + SESSION_TOOL_RAIL_WIDTH,
  });
  useUnfoldForLink({ sessionId, fold });
  const isStudioOver = place !== null;
  useInnerColumn({
    id: 'session-rail',
    label: fold.isFolded ? 'Show session pages' : 'Hide session pages',
    toggle: fold.toggle,
    isActive: !isStudioOver,
  });
  const target = useMemo<ObjectTarget>(() => ({ kind: 'session', sessionId }), [sessionId]);
  const controls = useActionControls({ target, scopeKey: sessionId });
  const isSessionChrome = !fold.isFolded;
  const isTopFailure = controls.failure !== null;
  return (
    <nav
      ref={resizable.targetRef}
      aria-label="Session pages"
      data-session-rail="session"
      data-rail-folded={fold.isFolded ? '' : undefined}
      style={{
        ...resizable.style,
        width: fold.isFolded ? COLLAPSED_RAIL_WIDTH : `var(${SESSION_RAIL_WIDTH_VAR})`,
      }}
      className={cn(
        'relative flex h-full min-h-0 shrink-0 flex-col gap-1 bg-background pb-2',
        'motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-out',
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
      {fold.isFolded ? (
        <div data-rail-actions="" className="flex w-11 shrink-0 flex-col items-center gap-1">
          <SessionLevelActions session={session} controls={controls} isFolded />
          {isTopFailure ? (
            <IconButton
              icon={RotateCw}
              label="Retry"
              tooltip={controls.failure?.message}
              tone="danger"
              onClick={controls.retry}
            />
          ) : null}
        </div>
      ) : null}
      <FoldLayers
        isFolded={fold.isFolded}
        openWidth={`var(${SESSION_RAIL_WIDTH_VAR})`}
        open={
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <SessionRailLevels session={session} isStudioOver={isStudioOver} />
          </div>
        }
        folded={
          <div className="flex min-h-0 flex-1 flex-col gap-1">
            <SessionRailIcons session={session} />
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
