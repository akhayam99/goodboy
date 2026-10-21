import { useMemo } from 'react';
import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { branchEntriesOf } from '../branches/branchStoryOf';
import { cardOrderOf } from '../branches/cardOrderOf';
import { useBranchDetails } from '../branches/useBranchDetails';
import { useBranchFacts } from '../branches/useBranchFacts';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { ActionCardActions } from '../next/useActionCardActions';
import type { SessionWorkModel } from '../useSessionWorkModel';
import { liveGroupsOf } from './liveGroupsOf';
import { needsYouCountOf } from './needsYouCountOf';
import { nowStateOf } from './nowStateOf';
import { NowBlockView, type NowChipParams } from './NowBlockView';
import { statusSentenceOf } from './statusSentenceOf';
import { StuckActions } from './StuckActions';
import { stuckAutoOf } from './stuckAutoOf';
import type { ReactNode } from 'react';

type Props = {
  readonly sessionId: SessionId;
  readonly model: SessionWorkModel;
  readonly cards: ReadonlyArray<ActionCardModel>;
  readonly doneOutcome: string | null;
  readonly actionsFor: ActionCardActions['actionsFor'];
  readonly onShowNext: () => void;
  readonly chipFor?: (params: NowChipParams) => ReactNode;
};

export const NowBlock = ({
  sessionId,
  model,
  cards,
  doneOutcome,
  actionsFor,
  onShowNext,
  chipFor,
}: Props) => {
  const agents = useAppStore((state) => state.sessionPhaseRuns[sessionId] ?? EMPTY_ARRAY);
  const groups = useMemo(() => liveGroupsOf({ model, agents, now: Date.now() }), [agents, model]);
  const { facts, hasMergedRequest } = useBranchFacts({ sessionId, groups });
  const detailByMountId = useBranchDetails({ sessionId, facts });
  const entries = useMemo(
    () =>
      branchEntriesOf({
        facts,
        cardOrderByMountId: cardOrderOf({ cards }),
        detailByMountId,
      }),
    [cards, detailByMountId, facts],
  );
  const state = nowStateOf({
    groups,
    cards,
    hasMergedRequest,
    hasDoneWork: doneOutcome !== null,
  });
  const sentence = statusSentenceOf({ groups, cards, doneOutcome, facts });
  const stuck = stuckAutoOf({ groups, cards, views: model.autoTrees });
  return (
    <NowBlockView
      sessionId={sessionId}
      state={state}
      sentence={sentence}
      needsYouCount={needsYouCountOf({ cards })}
      onShowNext={onShowNext}
      actions={
        stuck === null ? null : (
          <StuckActions
            sessionId={sessionId}
            group={stuck.group}
            card={stuck.card}
            view={stuck.view}
            actionsFor={actionsFor}
          />
        )
      }
      groups={groups}
      entries={entries}
      chipFor={chipFor}
    />
  );
};
