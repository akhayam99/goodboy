import type { TimelineTopLevelEntry } from '../../timeline/buildTimelineGroups';
import {
  addDecisionTotals,
  answeredCountOf,
  contextPayloadOf,
  laneRootOf,
  type DecisionTotals,
} from '../../timeline/laneFacts';
import { decisionCountsText } from '../../timeline/sessionEventPresentation';

type Params = {
  readonly entries: ReadonlyArray<TimelineTopLevelEntry>;
  readonly runId: string;
};

export type RunLaneFacts = {
  readonly answered: number;
  readonly contextText: string | null;
};

export const runLaneFactsOf = ({ entries, runId }: Params): RunLaneFacts => {
  let answered = 0;
  let totals: DecisionTotals = {};
  for (const entry of entries) {
    if (laneRootOf({ entry }) !== runId) {
      continue;
    }
    answered += answeredCountOf({ entry });
    totals = addDecisionTotals({ totals, payload: contextPayloadOf({ entry }) });
  }
  return { answered, contextText: decisionCountsText({ payload: totals }) };
};
