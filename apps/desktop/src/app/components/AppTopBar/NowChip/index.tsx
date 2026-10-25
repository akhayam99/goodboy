import { useEffect } from 'react';
import type { SessionAttentionReason, SessionId } from '@goodboy/types';
import {
  AnchoredPopover,
  Button,
  cn,
  Divider,
  FOCUS_RING,
  ICON_SIZE,
  ScrollFade,
  StatusDot,
  tintClasses,
  Tooltip,
  TOP_BAR_CONTROL,
  useDropdown,
} from '@goodboy/ui';
import { useAppStore, useCurrentWorkspace } from '../../../../store';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';
import { RunningScriptRow } from '../../../../features/scripts/components/RunningScriptRow';
import {
  useRunningScripts,
  type RunningScript,
} from '../../../../features/scripts/hooks/useRunningScripts';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { SessionHoverCard } from '../../../../features/workspace/components/SessionHoverCard';
import { useHoverCardTarget } from '../../../../features/workspace/components/SessionHoverCard/useHoverCardTarget';
import { NeedsYouSessionRow } from './NeedsYouSessionRow';
import { NowGroup } from './NowGroup';
import { attentionPlace } from '../../../../features/session/attentionPlace';
import { goToNextNeedsYou } from '../../../../features/workspace/components/SessionSwitcher/goToNextNeedsYou';

type Props = {
  readonly onOpenScript: (run: RunningScript) => void;
};

type SelectParams = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

type CountLabelParams = {
  readonly needsYou: number;
  readonly running: number;
  readonly scripts: number;
};

const PANEL_WIDTH = 360;
const PANEL_MAX_HEIGHT = 480;
const SEGMENT = 'flex items-center gap-1';
const SEGMENT_WORD = 'hidden text-muted-foreground @min-chrome-labels/topbar:inline';

const chipLabel = ({ needsYou, running, scripts }: CountLabelParams): string =>
  [
    needsYou > 0 ? `${needsYou} ${needsYou === 1 ? 'needs' : 'need'} you` : '',
    running > 0 ? `${running} ${running === 1 ? 'session' : 'sessions'} running` : '',
    scripts > 0 ? `${scripts} ${scripts === 1 ? 'script' : 'scripts'} running` : '',
  ]
    .filter((part) => part !== '')
    .join(', ');

export const NowChip = ({ onOpenScript }: Props) => {
  const workspace = useCurrentWorkspace();
  const { running, attention } = useNowSessions({});
  const needsYou = attention.countedSessions;
  const scripts = useRunningScripts();
  const navigate = useAppStore((state) => state.navigate);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const openStudio = useAppStore((state) => state.openStudio);
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-90',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_MAX_HEIGHT,
  });
  const { open: isOpen, close, toggle } = dropdown;
  const now = useNow(1_000, isOpen && scripts.length > 0);
  const hover = useHoverCardTarget();
  const { close: closeHover } = hover;
  const hoveredSession =
    [...needsYou, ...running].find((session) => session.id === hover.target?.sessionId) ?? null;

  useEffect(() => {
    if (!isOpen) {
      closeHover();
    }
  }, [isOpen, closeHover]);

  const total = needsYou.length + running.length + scripts.length;

  useEffect(() => {
    if (total === 0) {
      close();
    }
  }, [close, total]);

  if (total === 0) {
    return null;
  }

  const selectSession = ({ sessionId, reason }: SelectParams) => {
    close();
    navigate({ to: attentionPlace({ state: useAppStore.getState(), sessionId, reason }) });
  };

  const openScript = (run: RunningScript) => {
    close();
    onOpenScript(run);
  };

  const openMonitoring = () => {
    close();
    openStudio({ studio: { kind: 'monitoring' } });
  };

  const stopScript = (run: RunningScript) => {
    void cancelScript(run.sessionId, run.scriptId);
  };

  const goToNext = () => {
    close();
    goToNextNeedsYou({ state: useAppStore.getState() });
  };

  const label = chipLabel({
    needsYou: needsYou.length,
    running: running.length,
    scripts: scripts.length,
  });
  const ScriptsIcon = CONCEPT_ICONS.scripts;

  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Now"
      hasBackdrop
      trigger={
        <Tooltip
          content={label}
          isSuppressed={isOpen}
          {...(needsYou.length > 0 && { shortcut: 'session.nextNeedsYou' })}
        >
          <button
            type="button"
            onClick={toggle}
            aria-label={label}
            aria-expanded={isOpen}
            className={cn(
              TOP_BAR_CONTROL.height,
              TOP_BAR_CONTROL.radius,
              FOCUS_RING,
              'flex shrink-0 items-center gap-3 px-2 text-meta motion-safe:transition-colors',
              isOpen ? 'bg-muted' : 'hover:bg-hover',
            )}
          >
            {needsYou.length > 0 ? (
              <span className={SEGMENT} data-now-needs-you="">
                <StatusDot tone={attention.tone === 'danger' ? 'danger' : 'warning'} size="sm" />
                <span className="tabular-nums text-foreground">{needsYou.length}</span>
                <span className={SEGMENT_WORD}>
                  {needsYou.length === 1 ? 'needs you' : 'need you'}
                </span>
              </span>
            ) : null}
            {running.length > 0 ? (
              <span className={SEGMENT}>
                <StatusDot tone="info" size="sm" />
                <span className="font-medium tabular-nums text-foreground">{running.length}</span>
                <span className={SEGMENT_WORD}>running</span>
              </span>
            ) : null}
            {scripts.length > 0 ? (
              <span className={SEGMENT}>
                <ScriptsIcon
                  size={ICON_SIZE.row}
                  aria-hidden
                  className={tintClasses('info').icon}
                />
                <span className="font-medium tabular-nums text-foreground">{scripts.length}</span>
                <span className={SEGMENT_WORD}>scripts</span>
              </span>
            ) : null}
          </button>
        </Tooltip>
      }
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <span className="truncate text-meta font-semibold text-foreground">
          {workspace == null ? 'Now' : `Now in ${workspace.name}`}
        </span>
      </header>
      <Divider />
      <ScrollFade
        className="max-h-[27rem]"
        viewportClassName="pb-1"
        fadeSize={16}
        fadeFrom="elevated"
      >
        {needsYou.length > 0 ? (
          <NowGroup label="Needs you" count={needsYou.length} tone="warning">
            {needsYou.map((session) => (
              <NeedsYouSessionRow
                key={session.id}
                session={session}
                onSelect={selectSession}
                onHoverEnter={hover.enter}
                onHoverLeave={hover.leave}
              />
            ))}
          </NowGroup>
        ) : null}
        {running.length > 0 ? (
          <NowGroup label="Running" count={running.length} tone="info">
            {running.map((session) => (
              <NeedsYouSessionRow
                key={session.id}
                session={session}
                onSelect={selectSession}
                fallbackTone="info"
                onHoverEnter={hover.enter}
                onHoverLeave={hover.leave}
              />
            ))}
          </NowGroup>
        ) : null}
        {scripts.length > 0 ? (
          <NowGroup label="Scripts" count={scripts.length} tone="neutral">
            {scripts.map((run) => (
              <RunningScriptRow
                key={`${run.sessionId}:${run.scriptId}`}
                run={run}
                now={now}
                onOpen={openScript}
                onStop={stopScript}
              />
            ))}
          </NowGroup>
        ) : null}
      </ScrollFade>
      <div className="flex px-1 py-1">
        {needsYou.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={goToNext}>
            Next that needs you
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={openMonitoring}>
          Open Monitoring
        </Button>
      </div>
      <SessionHoverCard
        session={hoveredSession}
        isArchived={false}
        anchor={hover.target?.anchor ?? null}
        boundary={null}
        onKeep={hover.keep}
        onLeave={hover.leave}
        onClose={hover.close}
        onOpenAttention={selectSession}
        isFactsOnly
      />
    </AnchoredPopover>
  );
};
