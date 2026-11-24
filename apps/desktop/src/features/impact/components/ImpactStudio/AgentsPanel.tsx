import { useState } from 'react';
import type { TurnRoleInsight } from '@goodboy/db';
import {
  EmptyState,
  ErrorStrip,
  PaneShell,
  StatCard,
  StatCardsSkeleton,
  StudioWidget,
  formatUsd,
} from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import type { PaneFrame } from '../../../../shared/types/paneFrame';
import { NOT_LOADED_HINT, UNKNOWN_VALUE } from '../../../../shared/utils/unknownValue';
import type { ImpactRouting } from '../../hooks/useImpactRouting';
import { turnShareOf } from '../../lib';
import { AgentRoleRow } from './AgentRoleRow';

type CostHintParams = {
  readonly insight: TurnRoleInsight;
};

const costHintOf = ({ insight }: CostHintParams): string => {
  if (insight.costPerTurnUsd === null) {
    return 'No cost recorded';
  }
  const perTurn = `${formatUsd(insight.costPerTurnUsd)} per turn`;
  return insight.pricedTurns < insight.turns
    ? `${perTurn}, known for ${insight.pricedTurns} of ${insight.turns} turns`
    : perTurn;
};

const AGENT_TILE_LABELS = [
  'Agent turns',
  'Roles used',
  'Pinned by you',
  'Cost on agent turns',
] as const;

const HEAD = 'px-3 py-2';

const HEAD_RIGHT = 'px-3 py-2 text-right';

type Props = {
  readonly frame: PaneFrame;
  readonly routing: ImpactRouting;
};

export const AgentsPanel = ({ frame, routing }: Props) => {
  const [openRole, setOpenRole] = useState<string | null>(null);
  const insight = routing.insight.data;
  return (
    <PaneShell scroll="body" page="impact" {...frame}>
      <ErrorStrip
        labels={routing.insight.error === null ? [] : ['agent turns']}
        error={routing.insight.error}
        onRetry={routing.retry}
      />
      {routing.isLoading ? <StatCardsSkeleton label="Loading agent turns" /> : null}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {insight === null ? (
          AGENT_TILE_LABELS.map((label) => (
            <StatCard key={label} label={label} value={UNKNOWN_VALUE} hint={NOT_LOADED_HINT} />
          ))
        ) : (
          <>
            <StatCard label="Agent turns" value={String(insight.turns)} />
            <StatCard label="Roles used" value={String(insight.roles.length)} />
            <StatCard
              label="Pinned by you"
              value={
                turnShareOf({ part: insight.pinnedTurns, whole: insight.knownTurns }) ??
                UNKNOWN_VALUE
              }
              hint={`Known for ${insight.knownTurns} of ${insight.turns} turns`}
            />
            <StatCard
              label="Cost on agent turns"
              value={insight.costUsd === null ? UNKNOWN_VALUE : formatUsd(insight.costUsd)}
              hint={costHintOf({ insight })}
            />
          </>
        )}
      </div>
      <StudioWidget
        label="By role"
        hint="Agent turns only. Spend also counts chat and background tasks."
      >
        {insight !== null && insight.roles.length === 0 ? (
          <EmptyState
            size="section"
            icon={CONCEPT_ICONS.agents}
            tone={CONCEPT_TONE.agents}
            title="No agent turns in this window"
          />
        ) : (
          <table className="w-full text-left text-meta" aria-label="Agent turns by role">
            <thead className="text-eyebrow text-faint-foreground">
              <tr>
                <th className={HEAD}>Role</th>
                <th className={HEAD_RIGHT}>Turns</th>
                <th className={HEAD}>Models</th>
                <th className={HEAD}>Effort</th>
                <th className={HEAD_RIGHT}>Cost</th>
                <th className={HEAD_RIGHT}>Per turn</th>
                <th className={HEAD_RIGHT}>Pinned</th>
              </tr>
            </thead>
            <tbody>
              {insight?.roles.map((entry) => (
                <AgentRoleRow
                  key={entry.role}
                  entry={entry}
                  isOpen={openRole === entry.role}
                  onToggle={() => setOpenRole(openRole === entry.role ? null : entry.role)}
                />
              ))}
            </tbody>
          </table>
        )}
      </StudioWidget>
      <p className="text-meta text-faint-foreground">
        Pinned is known for workflow steps and the Lead&apos;s helpers. Other turns stay not known.
      </p>
    </PaneShell>
  );
};
