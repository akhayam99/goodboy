import { useEffect, useMemo } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { autoRetryTargetsOf } from '../../../auto/autoRetryTargetsOf';
import { BranchChip } from '../../central/branches/BranchChip';
import { useBranchLabels, type BranchLabelOf } from '../../central/branches/useBranchLabels';
import { DoneSection } from '../../central/done/DoneSection';
import { useDoneRows } from '../../central/done/useDoneRows';
import { NextStackView } from '../../central/next/NextStackView';
import { useNextCards } from '../../central/next/useNextCards';
import { NowBlock } from '../../central/now/NowBlock';
import { useSessionWorkModel } from '../../central/useSessionWorkModel';

type LeadChange = {
  readonly hasLead: boolean;
};

type Props = {
  readonly session: Session;
  readonly onLeadChange: (change: LeadChange) => void;
};

type ChipParams = {
  readonly branchLabelOf: BranchLabelOf;
  readonly mountId: string | null;
};

const AUTO_CLOCK_MS = 15_000;

const chipOf = ({ branchLabelOf, mountId }: ChipParams) => {
  const label = branchLabelOf({ mountId });
  return label === null ? null : <BranchChip label={label} />;
};

export const CentralColumn = ({ session, onLeadChange }: Props) => {
  const sessionId = session.id;
  const isArchived = session.archivedAt != null;
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, true);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock }),
    [agents, clock, model.autoTrees],
  );
  const { cards, actionsFor } = useNextCards({ session, model, autoTargets });
  const days = useDoneRows({ session, model });
  const branchLabelOf = useBranchLabels({ sessionId });
  const doneOutcome = days[0]?.rows[0]?.title ?? null;
  const hasLead = !isArchived && cards.length > 0;

  useEffect(() => {
    onLeadChange({ hasLead });
  }, [hasLead, onLeadChange]);

  return (
    <div data-central-column className={PANE_RHYTHM.stack}>
      {isArchived ? null : (
        <NowBlock
          sessionId={sessionId}
          model={model}
          cards={cards}
          doneOutcome={doneOutcome}
          chipFor={({ group }) => chipOf({ branchLabelOf, mountId: group.mountId })}
        />
      )}
      {isArchived ? null : (
        <NextStackView
          cards={cards}
          actionsFor={actionsFor}
          chipFor={({ card }) => chipOf({ branchLabelOf, mountId: card.mountId })}
        />
      )}
      <DoneSection
        session={session}
        model={model}
        days={days}
        chipFor={({ row }) => chipOf({ branchLabelOf, mountId: row.mountId })}
      />
    </div>
  );
};
