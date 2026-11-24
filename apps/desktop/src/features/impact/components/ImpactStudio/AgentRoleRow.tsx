import type { TurnEffortCount, TurnRoleEntry } from '@goodboy/db';
import { ChevronRight } from '@goodboy/ui/icons';
import { FOCUS_RING, ICON_SIZE, cn, formatUsd } from '@goodboy/ui';
import { AgentKindChip } from '../../../../shared/components/AgentKindChip';
import { RoutingLabel } from '../../../../shared/components/RoutingLabel';
import { EFFORT_LABEL } from '../../../chat/utils/chat-constants';
import { ROLE_LABEL, kindForRole } from '../../../session/agent-kind';
import { pinnedShareOf } from '../../lib';

type Props = {
  readonly entry: TurnRoleEntry;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
};

type EffortParams = {
  readonly efforts: ReadonlyArray<TurnEffortCount>;
};

type ShareParams = {
  readonly part: number;
  readonly whole: number;
};

const COLUMN_COUNT = 7;

const ROLE_NAMES: ReadonlyMap<string, string> = new Map(Object.entries(ROLE_LABEL));

const CELL = 'px-3 py-2';

const NUMBER_CELL = 'px-3 py-2 text-right tabular-nums';

const shareOf = ({ part, whole }: ShareParams): number =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;

const EFFORT_NAMES: ReadonlyMap<string, string> = new Map(Object.entries(EFFORT_LABEL));

const effortText = ({ efforts }: EffortParams): string => {
  const set = efforts.filter((entry) => entry.effort !== null);
  const top = set[0];
  if (top === undefined || top.effort === null) {
    return 'Not set';
  }
  const label = EFFORT_NAMES.get(top.effort) ?? top.effort;
  const whole = set.reduce((sum, entry) => sum + entry.turns, 0);
  return `${label} ${shareOf({ part: top.turns, whole })}%`;
};

export const AgentRoleRow = ({ entry, isOpen, onToggle }: Props) => {
  const name = ROLE_NAMES.get(entry.role) ?? entry.role;
  const isKnownRole = ROLE_NAMES.has(entry.role);
  const top = entry.models[0];
  const more = entry.models.length - 1;
  return (
    <>
      <tr data-role={entry.role} className="hover:[&>*]:bg-hover">
        <td className={CELL}>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label={`${name} models`}
            onClick={onToggle}
            className={cn('flex min-w-0 items-center gap-2 rounded-sm', FOCUS_RING)}
          >
            <ChevronRight
              size={ICON_SIZE.row}
              aria-hidden
              className={cn(
                'shrink-0 text-faint-foreground motion-safe:transition-transform',
                isOpen && 'rotate-90',
              )}
            />
            {isKnownRole ? (
              <AgentKindChip
                kind={kindForRole({ role: entry.role })}
                density="glyph"
                isDecorative
              />
            ) : null}
            <span className="min-w-0 truncate text-row text-foreground">{name}</span>
          </button>
        </td>
        <td className={cn(NUMBER_CELL, 'text-foreground')}>{entry.turns}</td>
        <td className={CELL}>
          {top === undefined ? null : (
            <span className="flex min-w-0 items-center gap-1">
              <RoutingLabel provider={top.provider} model={top.model} className="min-w-0" />
              {more > 0 ? <span className="shrink-0 text-faint-foreground">+{more}</span> : null}
            </span>
          )}
        </td>
        <td className={cn(CELL, 'text-muted-foreground')}>
          {effortText({ efforts: entry.efforts })}
        </td>
        <td className={cn(NUMBER_CELL, 'text-foreground')}>{formatUsd(entry.costUsd)}</td>
        <td className={cn(NUMBER_CELL, 'text-muted-foreground')}>
          {formatUsd(entry.costPerTurnUsd)}
        </td>
        <td className={cn(NUMBER_CELL, 'text-muted-foreground')}>
          {pinnedShareOf({ knownTurns: entry.knownTurns, pinnedTurns: entry.pinnedTurns }) ??
            'Not known'}
        </td>
      </tr>
      {isOpen ? (
        <tr data-detail={entry.role}>
          <td colSpan={COLUMN_COUNT} className="px-3 pb-3 pt-1">
            <div className="flex flex-col gap-2 rounded-md border border-border-soft bg-fill py-2">
              <table className="w-full text-left text-meta" aria-label={`${name} models`}>
                <thead className="text-eyebrow text-faint-foreground">
                  <tr>
                    <th className={CELL}>Model</th>
                    <th className={cn(CELL, 'text-right')}>Turns</th>
                    <th className={CELL}>Effort</th>
                    <th className={cn(CELL, 'text-right')}>Cost</th>
                    <th className={cn(CELL, 'text-right')}>Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.models.map((model) => (
                    <tr key={`${model.provider}//${model.model}`}>
                      <td className={CELL}>
                        <RoutingLabel provider={model.provider} model={model.model} />
                      </td>
                      <td className={cn(NUMBER_CELL, 'text-foreground')}>{model.turns}</td>
                      <td className={cn(CELL, 'text-muted-foreground')}>
                        {effortText({ efforts: model.efforts })}
                      </td>
                      <td className={cn(NUMBER_CELL, 'text-foreground')}>
                        {formatUsd(model.costUsd)}
                      </td>
                      <td
                        className={cn(
                          NUMBER_CELL,
                          model.failedTurns === 0
                            ? 'text-faint-foreground'
                            : 'text-muted-foreground',
                        )}
                      >
                        {model.failedTurns}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {entry.knownTurns > 0 ? (
                <p className="px-3 text-meta text-muted-foreground">
                  Pinned by you: {entry.pinnedTurns} turns. Lead&apos;s pick: {entry.leadPickTurns}{' '}
                  turns. Known for {entry.knownTurns} of {entry.turns} turns.
                </p>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
};
