import { useMemo } from 'react';
import { Divider, StatCard, cn, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { CapEditor } from './CapEditor';
import { ModelTable } from './ModelTable';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '../../../../shared/components/StudioWidget';
import { Sparkline } from '../../../../shared/components/Sparkline';
import { buildModelBreakdown, chronologicalTurnCosts, type WorkspaceTurn } from './lib';

type Density = 'studio' | 'glance';

type Props = {
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly softCapUsd: number | null;
  readonly onSaveCap: (capUsd: number) => Promise<void>;
  readonly onOpenSession?: (sessionId: SessionId) => void;
  readonly density?: Density;
};

export const SessionBudgetContent = ({
  turns,
  softCapUsd,
  onSaveCap,
  onOpenSession,
  density = 'studio',
}: Props) => {
  const records = useMemo(() => turns.map((turn) => turn.record), [turns]);
  const models = useMemo(() => buildModelBreakdown(records), [records]);
  const turnCosts = useMemo(() => chronologicalTurnCosts(records), [records]);
  const sessionCost = records.reduce(
    (sum, record) => (record.kind === 'summarizer' ? sum : sum + record.estimatedCostUsd),
    0,
  );
  const summarizer = records.reduce(
    (sum, record) => (record.kind === 'summarizer' ? sum + record.estimatedCostUsd : sum),
    0,
  );
  const turnCount = records.filter((record) => record.kind === 'turn').length;
  const isStudio = density === 'studio';
  const formatSpend = formatUsd;
  const showsTurns = isStudio && onOpenSession != null;

  return (
    <div className={cn('flex flex-col', isStudio ? 'gap-6' : 'gap-4')}>
      <div className={cn('grid gap-3', isStudio ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3')}>
        <div title={formatUsdPrecise(sessionCost)}>
          <StatCard label="session cost" value={formatSpend(sessionCost)} />
        </div>
        <div title={formatUsdPrecise(summarizer)}>
          <StatCard label="summarizer" value={formatSpend(summarizer)} />
        </div>
        <StatCard label="turns" value={String(turnCount)} />
      </div>
      <CapEditor
        label="session soft cap"
        hint="warn when this session passes the cap"
        currentCapUsd={softCapUsd}
        onSave={onSaveCap}
      />
      {!isStudio ? <Divider /> : null}
      <StudioWidget
        label="by model"
        className={isStudio ? undefined : 'border-none bg-transparent p-0'}
      >
        <ModelTable entries={models} formatSpent={formatSpend} borderedEmptyState={isStudio} />
      </StudioWidget>
      {showsTurns ? (
        <>
          <StudioWidget label="cost per turn">
            <Sparkline values={turnCosts} />
          </StudioWidget>
          <TurnsTable turns={turns} showSession={false} onOpenSession={onOpenSession} />
        </>
      ) : null}
    </div>
  );
};
