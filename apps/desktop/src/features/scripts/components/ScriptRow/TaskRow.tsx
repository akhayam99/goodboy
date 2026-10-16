import { Check, Circle, Square, X } from 'lucide-react';
import { InteractiveRow, StatusDot, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { lastOutputLine } from '../../lastOutputLine';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { describeLastRun } from './describeLastRun';
import { RunToggle } from './RunToggle';
import { SCRIPT_ROW_CELL } from './scriptRowCells';
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
  onOpen,
  onRun,
  onStop,
}: ScriptRowProps) => {
  const isRunning = record?.status === 'pending';
  const lastRun = describeLastRun({ record, now });
  const isFailed = lastRun?.glyph === 'failed';
  const failedLine = isFailed ? lastOutputLine({ output: record?.result?.stdout }) : null;
  const menu = useObjectMenuTrigger({ target, anchorKey: `script:${script.key}` });
  const meta =
    lastRun === null ? (blockedReason ?? '') : joinFacts({ facts: [lastRun.word, lastRun.detail] });

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
      <span aria-hidden className={SCRIPT_ROW_CELL.glyph}>
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
          <span className="truncate text-code text-faint-foreground">{failedLine}</span>
        )}
      </span>
      <span data-slot="script-meta" className={SCRIPT_ROW_CELL.meta}>
        {meta === '' ? null : <span className="truncate">{meta}</span>}
      </span>
      <RunToggle
        name={script.name}
        isRunning={isRunning}
        blockedReason={blockedReason}
        onRun={() => onRun(script)}
        onStop={() => onStop(script)}
      />
    </InteractiveRow>
  );
};
