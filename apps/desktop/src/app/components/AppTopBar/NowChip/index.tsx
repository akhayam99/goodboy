import { useEffect, useState } from 'react';
import type { Session, SessionId } from '@goodboy/types';
import {
  AnchoredPopover,
  Divider,
  ScrollFade,
  StatusDot,
  cn,
  tintClasses,
  useDropdown,
} from '@goodboy/ui';
import {
  EMPTY_ARRAY,
  useAppStore,
  useCurrentWorkspace,
  useSessions,
  useStageGroupedSessions,
} from '../../../../store';
import { RunningScriptRow } from '../../../../features/scripts/components/RunningScriptRow';
import {
  useRunningScripts,
  type RunningScript,
} from '../../../../features/scripts/hooks/useRunningScripts';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NeedsYouSessionRow } from './NeedsYouSessionRow';
import { NowGroup } from './NowGroup';

type Props = {
  readonly onOpenScript: (run: RunningScript) => void;
};

type SelectParams = {
  readonly sessionId: SessionId;
};

type CountLabelParams = {
  readonly attention: number;
  readonly running: number;
  readonly scripts: number;
};

const PANEL_WIDTH = 360;
const PANEL_MAX_HEIGHT = 480;
const SEGMENT = 'flex items-center gap-1';
const SEGMENT_WORD = 'hidden text-muted-foreground @min-chrome-labels/topbar:inline';

const chipLabel = ({ attention, running, scripts }: CountLabelParams): string =>
  [
    attention > 0 ? `${attention} ${attention === 1 ? 'session needs' : 'sessions need'} you` : '',
    running > 0 ? `${running} running` : '',
    scripts > 0 ? `${scripts} ${scripts === 1 ? 'script' : 'scripts'} running` : '',
  ]
    .filter((part) => part !== '')
    .join(', ');

export const NowChip = ({ onOpenScript }: Props) => {
  const workspace = useCurrentWorkspace();
  const sessions = useSessions();
  const groups = useStageGroupedSessions(workspace?.id ?? null, sessions);
  const scripts = useRunningScripts();
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);
  const setActiveLens = useAppStore((state) => state.setActiveLens);
  const cancelScript = useAppStore((state) => state.cancelScript);
  const [now, setNow] = useState(() => Date.now());
  const dropdown = useDropdown({
    align: 'end',
    width: 'w-90',
    expectedWidth: PANEL_WIDTH,
    expectedHeight: PANEL_MAX_HEIGHT,
  });
  const { open: isOpen, close, toggle } = dropdown;

  const needsYou: ReadonlyArray<Session> =
    workspace == null
      ? EMPTY_ARRAY
      : (groups.find((group) => group.key === 'attention')?.sessions ?? EMPTY_ARRAY);
  const running: ReadonlyArray<Session> =
    workspace == null
      ? EMPTY_ARRAY
      : (groups.find((group) => group.key === 'running')?.sessions ?? EMPTY_ARRAY);
  const total = needsYou.length + running.length + scripts.length;

  useEffect(() => {
    if (total === 0) {
      close();
    }
  }, [close, total]);

  useEffect(() => {
    if (!isOpen || scripts.length === 0) {
      return;
    }
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [isOpen, scripts.length]);

  if (total === 0) {
    return null;
  }

  const selectSession = ({ sessionId }: SelectParams) => {
    close();
    void setCurrentSession(sessionId).then(() => {
      setActiveLens(sessionId, null);
    });
  };

  const openScript = (run: RunningScript) => {
    close();
    onOpenScript(run);
  };

  const stopScript = (run: RunningScript) => {
    void cancelScript(run.sessionId, run.scriptId);
  };

  const label = chipLabel({
    attention: needsYou.length,
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
        <button
          type="button"
          onClick={toggle}
          aria-label={label}
          title={label}
          aria-expanded={isOpen}
          className={cn(
            'flex shrink-0 items-center gap-2.5 rounded-sm px-1.5 py-1 text-secondary motion-safe:transition-colors',
            isOpen ? 'bg-muted' : 'hover:bg-hover',
          )}
        >
          {needsYou.length > 0 ? (
            <span className={SEGMENT}>
              <StatusDot tone="warning" size="sm" pulsing />
              <span className="font-medium tabular-nums text-foreground">{needsYou.length}</span>
              <span className={SEGMENT_WORD}>need you</span>
            </span>
          ) : null}
          {running.length > 0 ? (
            <span className={SEGMENT}>
              <StatusDot tone="info" size="sm" pulsing />
              <span className="font-medium tabular-nums text-foreground">{running.length}</span>
              <span className={SEGMENT_WORD}>running</span>
            </span>
          ) : null}
          {scripts.length > 0 ? (
            <span className={SEGMENT}>
              <ScriptsIcon size={ICON_SIZE.row} aria-hidden className={tintClasses('info').icon} />
              <span className="font-medium tabular-nums text-foreground">{scripts.length}</span>
              <span className={SEGMENT_WORD}>scripts</span>
            </span>
          ) : null}
        </button>
      }
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <span className="truncate text-label font-semibold text-foreground">
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
              <NeedsYouSessionRow key={session.id} session={session} onSelect={selectSession} />
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
    </AnchoredPopover>
  );
};
