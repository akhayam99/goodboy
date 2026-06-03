import { useMemo } from 'react';
import { formatUsdPrecise } from '@goodboy/ui';
import { ModelTable } from './ModelTable';
import { PanelShell } from './PanelShell';
import { Sparkline } from './Sparkline';
import { StatCard } from './StatCard';
import { TurnsTable } from './TurnsTable';
import { Widget } from './Widget';
import { buildModelBreakdown, chronologicalTurnCosts, type WorkspaceTurn } from './lib';

interface Props {
  readonly goal: string;
  readonly isCurrent: boolean;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
}

export function SessionPanel({ goal, isCurrent, turns }: Props) {
  const records = useMemo(() => turns.map((t) => t.record), [turns]);
  const models = useMemo(() => buildModelBreakdown(records), [records]);
  const turnCosts = useMemo(() => chronologicalTurnCosts(records), [records]);

  const sessionCost = records.reduce(
    (sum, r) => (r.kind === 'turn' ? sum + r.estimatedCostUsd : sum),
    0,
  );
  const summarizer = records.reduce(
    (sum, r) => (r.kind === 'summarizer' ? sum + r.estimatedCostUsd : sum),
    0,
  );
  const turnCount = records.filter((r) => r.kind === 'turn').length;
  const providerCount = new Set(records.map((r) => r.provider)).size;

  return (
    <PanelShell title={goal} subtitle={isCurrent ? 'current session' : 'session spend'}>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="session cost" value={formatUsdPrecise(sessionCost)} />
        <StatCard label="summarizer" value={formatUsdPrecise(summarizer)} />
        <StatCard label="turns" value={String(turnCount)} />
      </div>

      <Widget label="by model">
        <ModelTable entries={models} showProvider={providerCount >= 2} />
      </Widget>

      <Widget label="cost per turn">
        <Sparkline values={turnCosts} />
      </Widget>

      <TurnsTable turns={turns} showProvider={providerCount >= 2} showSession={false} />
    </PanelShell>
  );
}
