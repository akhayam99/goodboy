import { useMemo } from 'react';
import { StatCard, formatUsdPrecise } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { OpenSessionButton } from '../../../../shared/components/OpenSessionButton';
import { CapEditor } from './CapEditor';
import { ModelTable } from './ModelTable';
import { StudioPanel } from '../../../../shared/components/StudioPanel';
import { Sparkline } from './Sparkline';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { buildModelBreakdown, chronologicalTurnCosts, type WorkspaceTurn } from './lib';

type Props = {
  readonly sessionId: SessionId;
  readonly goal: string;
  readonly isCurrent: boolean;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly softCapUsd: number | null;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
  readonly onOpened: () => void;
};

export const SessionPanel = ({
  sessionId,
  goal,
  isCurrent,
  turns,
  softCapUsd,
  onSaveCap,
  onOpened,
}: Props) => {
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

  return (
    <StudioPanel
      title={goal}
      subtitle={isCurrent ? 'current session' : 'session spend'}
      action={<OpenSessionButton sessionId={sessionId} onOpened={onOpened} variant="secondary" />}
    >
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
    </StudioPanel>
  );
};
