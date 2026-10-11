import { Play, RotateCw, Square } from 'lucide-react';
import { Chip, IconButton, InteractiveRow, StatusDot, Tooltip, type Tone } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { openUrl } from '../../../../shared/lib/editor';
import { formatBytes } from '../../../../shared/utils/formatBytes';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { lastOutputLine } from '../../lastOutputLine';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { describeLastRun } from './describeLastRun';
import { RowActions } from './RowActions';
import type { ScriptRowProps } from './scriptRowProps';

type DotToneParams = {
  readonly glyph: string | undefined;
};

const dotTone = ({ glyph }: DotToneParams): Tone => {
  if (glyph === 'running') {
    return 'info';
  }
  return glyph === 'failed' ? 'danger' : 'neutral';
};

export const ServiceRow = ({
  script,
  record,
  now,
  isSelected,
  blockedReason,
  target,
  isPinned,
  expectedPort,
  portHolder,
  facts,
  onTogglePin,
  onOpen,
  onRun,
  onStop,
  onRestart,
}: ScriptRowProps) => {
  const lastRun = describeLastRun({ record, now });
  const isRunning = lastRun?.glyph === 'running';
  const output = isRunning ? record?.output : record?.result?.stdout;
  const line = lastRun === null ? null : lastOutputLine({ output });
  const livePort = facts?.ports[0] ?? null;
  const isPortBusy = portHolder !== null && expectedPort !== null && livePort === null;
  const hasSecondLine = lastRun !== null && (isRunning || line !== null);
  const menu = useObjectMenuTrigger({ target, anchorKey: `script:${script.key}` });

  return (
    <InteractiveRow
      label={`Show ${script.name} output`}
      isSelected={isSelected}
      onOpen={() => onOpen(script)}
      menu={menu}
      frameClassName="group"
      dataAttributes={{ 'data-script-key': script.key }}
      className={
        hasSecondLine ? 'flex h-12 items-center gap-2 px-2' : 'flex h-8 items-center gap-2 px-2'
      }
    >
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
        <StatusDot tone={dotTone({ glyph: lastRun?.glyph })} size="sm" pulsing={isRunning} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-row text-foreground">{script.name}</span>
          {lastRun === null || isRunning ? null : (
            <span className="shrink-0 text-meta text-muted-foreground">{lastRun.word}</span>
          )}
        </span>
        {hasSecondLine ? (
          <span className="truncate font-mono text-code text-faint-foreground">
            {line ?? 'Waiting for output'}
          </span>
        ) : null}
      </span>
      {livePort === null ? null : (
        <Chip
          as="button"
          kind="id"
          tone="info"
          label={`:${livePort}`}
          ariaLabel={`Open localhost:${livePort}`}
          onClick={() => void openUrl(`http://localhost:${livePort}`)}
        />
      )}
      {livePort !== null || expectedPort === null ? null : isPortBusy ? (
        <Tooltip content={portHolder}>
          <span>
            <Chip kind="id" tone="warning" label={`:${expectedPort} in use`} />
          </span>
        </Tooltip>
      ) : (
        <Chip kind="id" tone="neutral" label={`:${expectedPort}`} />
      )}
      {isRunning && record !== null ? (
        <span className="flex shrink-0 items-center gap-3 text-meta tabular-nums text-muted-foreground">
          <span>{formatDuration({ durationMs: now - record.startedAt })}</span>
          {facts === null ? null : (
            <>
              <span>{`${Math.round(facts.cpuPercent)}%`}</span>
              <span>{formatBytes({ bytes: facts.rssBytes })}</span>
            </>
          )}
        </span>
      ) : null}
      <RowActions
        name={script.name}
        scriptKey={script.key}
        target={target}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
      />
      {isRunning ? (
        <span className="flex shrink-0 items-center">
          <IconButton
            size="xs"
            variant="ghost"
            icon={RotateCw}
            iconSize={ICON_SIZE.row}
            label={`Restart ${script.name}`}
            onClick={() => onRestart(script)}
          />
          <IconButton
            size="xs"
            variant="ghost"
            icon={Square}
            iconSize={ICON_SIZE.row}
            label={`Stop ${script.name}`}
            onClick={() => onStop(script)}
          />
        </span>
      ) : (
        <span className="flex w-7 shrink-0 items-center justify-center">
          <IconButton
            size="xs"
            variant="ghost"
            icon={Play}
            iconSize={ICON_SIZE.row}
            label={`Run ${script.name}`}
            tooltip={blockedReason ?? undefined}
            disabled={blockedReason !== null}
            onClick={() => onRun(script)}
          />
        </span>
      )}
    </InteractiveRow>
  );
};
