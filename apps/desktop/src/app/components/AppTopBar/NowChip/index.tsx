import { useEffect } from 'react';
import type { SessionAttentionReason, SessionId } from '@goodboy/types';
import {
  AnchoredPopover,
  Button,
  Divider,
  ScrollFade,
  StatusDot,
  FOCUS_RING,
  TOP_BAR_CONTROL,
  cn,
  tintClasses,
  useDropdown,
  Tooltip,
} from '@goodboy/ui';
import { useAppStore, useCurrentWorkspace } from '../../../../store';
import { useNowSessions } from '../../../../shared/hooks/useNowSessions';
import { RunningScriptRow } from '../../../../features/scripts/components/RunningScriptRow';
import {
  useRunningScripts,
  type RunningScript,
} from '../../../../features/scripts/hooks/useRunningScripts';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';
import { NeedsYouSessionRow } from './NeedsYouSessionRow';
import { NowGroup } from './NowGroup';
import { attentionPlace } from '../../../../features/session/attentionPlace';

type Props = {
  readonly onOpenScript: (run: RunningScript) => void;
};

type SelectParams = {
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | null;
};

type CountLabelParams = {
  readonly running: number;
  readonly scripts: number;
};

const PANEL_WIDTH = 360;
const PANEL_MAX_HEIGHT = 480;
const SEGMENT = 'flex items-center gap-1';
const SEGMENT_WORD = 'hidden text-muted-foreground @min-chrome-labels/topbar:inline';

const chipLabel = ({ running, scripts }: CountLabelParams): string =>
  [
    running > 0 ? `${running} ${running === 1 ? 'session' : 'sessions'} running` : '',
    scripts > 0 ? `${scripts} ${scripts === 1 ? 'script' : 'scripts'} running` : '',
  ]
    .filter((part) => part !== '')
    .join(', ');

export const NowChip = ({ onOpenScript }: Props) => {
  const workspace = useCurrentWorkspace();
  const { running } = useNowSessions({});
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

  const total = running.length + scripts.length;

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

  const label = chipLabel({
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
        <Tooltip content={label} isSuppressed={isOpen}>
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
      <div className="flex px-1 py-1">
        <Button size="sm" variant="ghost" onClick={openMonitoring}>
          Open Monitoring
        </Button>
      </div>
    </AnchoredPopover>
  );
};
