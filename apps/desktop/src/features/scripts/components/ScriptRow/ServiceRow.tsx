import { Chip, FactCard, InteractiveRow, StatusDot, Tooltip, type Tone } from '@goodboy/ui';
import { openUrl } from '../../../../shared/lib/editor';
import { joinFacts } from '../../../../shared/utils/joinFacts';
import { lastOutputLine } from '../../../../shared/utils/lastOutputLine';
import { useObjectMenuTrigger } from '../../../actions/useObjectMenuTrigger';
import { describeLastRun } from './describeLastRun';
import { RunToggle } from './RunToggle';
import { SCRIPT_ROW_CELL } from './scriptRowCells';
import { serviceUsageCardOf } from './serviceUsageCardOf';
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
  expectedPort,
  portHolder,
  facts,
  onOpen,
  onRun,
  onStop,
}: ScriptRowProps) => {
  const lastRun = describeLastRun({ record, now });
  const isRunning = lastRun?.glyph === 'running';
  const output = isRunning ? record?.output : record?.result?.stdout;
  const line = lastRun === null ? null : lastOutputLine({ output });
  const livePort = facts?.ports[0] ?? null;
  const isPortBusy = portHolder !== null && expectedPort !== null && livePort === null;
  const hasSecondLine = lastRun !== null && (isRunning || line !== null);
  const menu = useObjectMenuTrigger({ target, anchorKey: `script:${script.key}` });
  const meta = joinFacts({ facts: [lastRun?.word, lastRun?.detail] });
  const usage = serviceUsageCardOf({ name: script.name, facts, isRunning });
  const metaText = <span className="truncate">{meta}</span>;

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
      <span aria-hidden className={SCRIPT_ROW_CELL.glyph}>
        <StatusDot tone={dotTone({ glyph: lastRun?.glyph })} size="sm" pulsing={isRunning} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-row text-foreground">{script.name}</span>
        {hasSecondLine ? (
          <span className="truncate text-code text-faint-foreground">
            {line ?? 'Waiting for output'}
          </span>
        ) : null}
      </span>
      <span data-slot="script-meta" className={SCRIPT_ROW_CELL.meta}>
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
        {livePort === null && expectedPort !== null && isPortBusy ? (
          <Tooltip content={portHolder}>
            <span>
              <Chip kind="id" tone="warning" label={`:${expectedPort} in use`} />
            </span>
          </Tooltip>
        ) : null}
        {livePort === null && expectedPort !== null && !isPortBusy ? (
          <Chip kind="id" tone="neutral" label={`:${expectedPort}`} />
        ) : null}
        {meta === '' ? null : usage === null ? (
          metaText
        ) : (
          <FactCard card={usage}>{metaText}</FactCard>
        )}
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
