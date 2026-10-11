import type { JobActivityFacts } from '../../../store/slices/history/jobFactsByAgentId';
import type { RowAsk, RowState } from '../../workTreeModel/rowState';

type Params = {
  readonly facts: JobActivityFacts;
  readonly resolved: RowState;
};

const askOf = ({ facts, resolved }: Params): RowAsk | null =>
  !facts.isAutomatic && resolved.ask?.kind === 'answer' ? resolved.ask : null;

export const jobRowState = ({ facts, resolved }: Params): RowState => ({
  phase: facts.phase,
  reason: { kind: 'job', title: facts.title, word: facts.word, isMuted: facts.isAutomatic },
  ask: askOf({ facts, resolved }),
});
