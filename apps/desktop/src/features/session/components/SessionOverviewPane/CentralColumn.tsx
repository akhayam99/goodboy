import { useCallback, useEffect, useMemo, useRef } from 'react';
import { PANE_RHYTHM } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { autoRetryTargetsOf } from '../../../auto/autoRetryTargetsOf';
import { BranchChip } from '../../central/branches/BranchChip';
import { useBranchLabels, type BranchLabelOf } from '../../central/branches/useBranchLabels';
import { useBranchNames } from '../../central/branches/useBranchNames';
import { DoneSection } from '../../central/done/DoneSection';
import { useDoneRows } from '../../central/done/useDoneRows';
import type { ActionCardModel } from '../../central/next/actionCardsOf';
import { NextStackView } from '../../central/next/NextStackView';
import { useNextCards } from '../../central/next/useNextCards';
import { useRebaseStopRows } from '../../../history/useRebaseStopRows';
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

type CardParams = {
  readonly card: ActionCardModel;
};

type NameParams = CardParams & {
  readonly branchLabelOf: BranchLabelOf;
};

const nameOf = ({ branchLabelOf, card }: NameParams): string | null => {
  const { source } = card;
  if (source.kind === 'auto' && source.target.plan !== null) {
    return source.target.plan.name;
  }
  return branchLabelOf({ mountId: card.mountId })?.branch ?? null;
};

const chipOf = ({ branchLabelOf, mountId }: ChipParams) => {
  const label = branchLabelOf({ mountId });
  return label === null ? null : <BranchChip label={label} />;
};

export const CentralColumn = ({ session, onLeadChange }: Props) => {
  const sessionId = session.id;
  const columnRef = useRef<HTMLDivElement>(null);
  const isArchived = session.archivedAt != null;
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, true);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock }),
    [agents, clock, model.autoTrees],
  );
  const { cards, actionsFor, openFor } = useNextCards({ session, model, autoTargets });
  const days = useDoneRows({ session, model });
  const branchLabelOf = useBranchLabels({ sessionId });
  const branchNameOf = useBranchNames({ sessionId });
  const branchFor = useCallback(
    ({ card }: CardParams) => branchNameOf({ mountId: card.mountId }),
    [branchNameOf],
  );
  const stopRowFor = useRebaseStopRows({ sessionId });
  const doneOutcome = days[0]?.rows[0]?.title ?? null;
  const hasLead = !isArchived && cards.length > 0;

  useEffect(() => {
    onLeadChange({ hasLead });
  }, [hasLead, onLeadChange]);

  const showNext = useCallback(() => {
    columnRef.current
      ?.querySelector('[data-next-stack]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div ref={columnRef} data-central-column className={PANE_RHYTHM.stack}>
      {isArchived ? null : (
        <NowBlock
          sessionId={sessionId}
          model={model}
          cards={cards}
          doneOutcome={doneOutcome}
          actionsFor={actionsFor}
          onShowNext={showNext}
          chipFor={({ group }) => chipOf({ branchLabelOf, mountId: group.mountId })}
        />
      )}
      {isArchived ? null : (
        <NextStackView
          sessionId={sessionId}
          cards={cards}
          actionsFor={actionsFor}
          openFor={openFor}
          chipFor={({ card }) => chipOf({ branchLabelOf, mountId: card.mountId })}
          nameFor={({ card }) => nameOf({ branchLabelOf, card })}
          branchFor={branchFor}
          stopRowFor={stopRowFor}
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
