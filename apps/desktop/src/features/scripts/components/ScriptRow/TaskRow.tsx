import { Check, Circle, Play, Square, X } from 'lucide-react';
import { IconButton, InteractiveRow, StatusDot, Tooltip, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { lastOutputLine } from '../../lastOutputLine';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { describeLastRun } from './describeLastRun';
import { RowActions } from './RowActions';
import type { ScriptRowProps } from './scriptRowProps';

const runsInLabel = ({ script }: Pick<ScriptRowProps, 'script'>): string =>
  script.relDir === ''
    ? `Runs ${script.invocation}`
    : `Runs ${script.invocation} in ${script.relDir}`;

export const TaskRow = ({
  script,
  record,
  now,
  isSelected,
  blockedReason,
  target,
  isPinned,
  onTogglePin,
  onOpen,
  onRun,
  onStop,
}: ScriptRowProps) => {
  const isRunning = record?.status === 'pending';
  const lastRun = describeLastRun({ record, now });
  const isFailed = lastRun?.glyph === 'failed';
  const failedLine = isFailed ? lastOutputLine({ output: record?.result?.stdout }) : null;
  const menu = useObjectMenuTrigger({ target, anchorKey: `script:${script.key}` });

  return (
    <InteractiveRow
      label={`Show ${script.name} output`}
      isSelected={isSelected}
      onOpen={() => onOpen(script)}
      menu={menu}
      frameClassName="group"
      dataAttributes={{ 'data-script-key': script.key }}
      className="flex min-h-8 items-center gap-2 px-2"
    >
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center">
        {lastRun?.glyph === 'running' ? <StatusDot tone="info" size="sm" pulsing /> : null}
        {lastRun?.glyph === 'passed' ? (
          <Check size={ICON_SIZE.row} className="text-success" />
        ) : null}
        {isFailed ? <X size={ICON_SIZE.row} className="text-danger" /> : null}
        {lastRun?.glyph === 'stopped' ? (
          <Square size={ICON_SIZE.row} className="text-faint-foreground" />
        ) : null}
        {lastRun === null ? (
          <Circle size={ICON_SIZE.row} className="text-faint-foreground" />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Tooltip content={runsInLabel({ script })}>
          <span className="truncate text-row text-foreground">{script.name}</span>
        </Tooltip>
        {failedLine === null ? null : (
          <span className="truncate text-code text-danger">{failedLine}</span>
        )}
      </span>
      <span
        className={cn(
          'shrink-0 truncate text-meta tabular-nums',
          isFailed ? 'text-danger' : 'text-muted-foreground',
        )}
      >
        {lastRun === null
          ? (blockedReason ?? '')
          : [lastRun.word, lastRun.detail].filter((part) => part !== null).join(' · ')}
      </span>
      <RowActions
        name={script.name}
        scriptKey={script.key}
        target={target}
        isPinned={isPinned}
        onTogglePin={onTogglePin}
      />
      <span className="flex w-7 shrink-0 items-center justify-center">
        {isRunning ? (
          <IconButton
            size="xs"
            variant="ghost"
            icon={Square}
            iconSize={ICON_SIZE.row}
            label={`Stop ${script.name}`}
            onClick={() => onStop(script)}
          />
        ) : (
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
        )}
      </span>
    </InteractiveRow>
  );
};
