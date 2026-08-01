import { useMemo } from 'react';
import { StatCard, formatUsdPrecise } from '@goodboy/ui';
import { CapEditor } from './CapEditor';
import { ModelTable } from './ModelTable';
import { Sparkline } from './Sparkline';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { buildModelBreakdown, chronologicalTurnCosts, type WorkspaceTurn } from './lib';

type Props = {
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly softCapUsd: number | null;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
};

export const SessionBudgetContent = ({ turns, softCapUsd, onSaveCap }: Props) => {
  const records = useMemo(() => turns.map((turn) => turn.record), [turns]);
  const models = useMemo(() => buildModelBreakdown(records), [records]);
  const turnCosts = useMemo(() => chronologicalTurnCosts(records), [records]);
  const sessionCost = records.reduce(
    (sum, record) => (record.kind === 'turn' ? sum + record.estimatedCostUsd : sum),
    0,
  );
  const summarizer = records.reduce(
    (sum, record) => (record.kind === 'summarizer' ? sum + record.estimatedCostUsd : sum),
    0,
  );
  const turnCount = records.filter((record) => record.kind === 'turn').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="session cost" value={formatUsdPrecise(sessionCost)} />
        <StatCard label="summarizer" value={formatUsdPrecise(summarizer)} />
        <StatCard label="turns" value={String(turnCount)} />
      </div>
      <CapEditor
        label="session soft cap"
        hint="warn when this session passes the cap"
        currentCapUsd={softCapUsd}
        onSave={onSaveCap}
      />
      <StudioWidget label="by model">
        <ModelTable entries={models} />
      </StudioWidget>
      <StudioWidget label="cost per turn">
        <Sparkline values={turnCosts} />
      </StudioWidget>
      <TurnsTable turns={turns} showSession={false} />
    </div>
  );
};
