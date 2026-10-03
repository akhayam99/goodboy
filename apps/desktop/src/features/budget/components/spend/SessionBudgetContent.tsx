import { useMemo, useState } from 'react';
import { StatCard, formatUsd, formatUsdPrecise } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { SpendLimitRow } from '../SessionSpendPopover/SpendLimitRow';
import { ModelTable } from './ModelTable';
import { TurnsTable } from './TurnsTable';
import { StudioWidget } from '@goodboy/ui';
import { Sparkline } from '@goodboy/ui';
import { buildModelBreakdown, chronologicalTurnCosts, type WorkspaceTurn } from './lib';

type Props = {
  readonly sessionId: SessionId;
  readonly turns: ReadonlyArray<WorkspaceTurn>;
  readonly onOpenSession?: (sessionId: SessionId) => void;
};

export const SessionBudgetContent = ({ sessionId, turns, onOpenSession }: Props) => {
  const limit = useAppStore((state) => state.sessionBudgets[sessionId] ?? null);
  const [isEditing, setIsEditing] = useState(false);
  const records = useMemo(() => turns.map((turn) => turn.record), [turns]);
  const models = useMemo(() => buildModelBreakdown(records), [records]);
  const turnCosts = useMemo(() => chronologicalTurnCosts(records), [records]);
  const totalUsd = records.reduce((sum, record) => sum + record.estimatedCostUsd, 0);
  const contextUsd = records.reduce(
    (sum, record) => (record.kind === 'summarizer' ? sum + record.estimatedCostUsd : sum),
    0,
  );
  const turnCount = records.filter((record) => record.kind === 'turn').length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <div title={formatUsdPrecise(totalUsd)}>
          <StatCard label="Session spend" value={formatUsd(totalUsd)} />
        </div>
        <div title={formatUsdPrecise(contextUsd)}>
          <StatCard label="Keeping context up to date" value={formatUsd(contextUsd)} />
        </div>
        <StatCard label="Turns" value={String(turnCount)} />
      </div>
      <SpendLimitRow
        sessionId={sessionId}
        totalUsd={totalUsd}
        limit={limit}
        isEditing={isEditing}
        onEditingChange={setIsEditing}
      />
      <StudioWidget label="by model">
        <ModelTable entries={models} formatSpent={formatUsd} />
      </StudioWidget>
      {onOpenSession !== undefined ? (
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
