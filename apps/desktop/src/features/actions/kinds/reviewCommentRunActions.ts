import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { agentPlace } from '../../../store/slices/navigation/place';
import { COMMENT_RUN_COPY } from '../../resolve/commentRunCopy';
import { requestReview } from '../../review/reviewRequest';
import type { ActionDefinition } from '../types';
import type { ReviewCommentFacts } from './reviewComment';

type FactsParams = {
  readonly facts: ReviewCommentFacts;
};

const isRunFirst = ({ facts }: FactsParams): boolean =>
  facts.lane === 'run' && facts.state === 'new' && facts.canStartRun;

const isFree = ({ facts }: FactsParams): boolean =>
  facts.lane !== 'in_run' && facts.remote === null;

export const REVIEW_COMMENT_RUN_ACTIONS: ReadonlyArray<ActionDefinition<ReviewCommentFacts>> = [
  {
    id: 'reviewComment.openRun',
    label: COMMENT_RUN_COPY.openRun,
    icon: CONCEPT_ICONS.runs,
    group: 'open',
    when: ({ facts }) => facts.runAgentId !== null,
    slot: () => 'primary',
    run: ({ facts, env }) => {
      if (facts.runAgentId === null) {
        return;
      }
      env
        .getState()
        .navigate({ to: agentPlace({ sessionId: facts.sessionId, agentId: facts.runAgentId }) });
    },
  },
  {
    id: 'reviewComment.startRun',
    label: COMMENT_RUN_COPY.startRun,
    icon: CONCEPT_ICONS.runs,
    group: 'act',
    description: () => COMMENT_RUN_COPY.startRunNote,
    when: ({ facts }) =>
      (facts.state === 'new' || facts.state === 'failed') && facts.canStartRun && isFree({ facts }),
    slot: ({ facts }) => (isRunFirst({ facts }) ? 'primary' : 'menu'),
    run: ({ facts, env }) =>
      env.getState().openCommentRunStart({ sessionId: facts.sessionId, threadId: facts.threadId }),
  },
  {
    id: 'reviewComment.draft',
    label: ({ facts }) => (isRunFirst({ facts }) ? COMMENT_RUN_COPY.fixAsOne : 'Fix'),
    icon: CONCEPT_ICONS.agents,
    group: 'act',
    shortcut: 'review.fix',
    description: ({ facts }) => (isRunFirst({ facts }) ? COMMENT_RUN_COPY.fixAsOneNote : null),
    when: ({ facts }) => facts.state === 'new' && isFree({ facts }),
    slot: ({ facts }) => (isRunFirst({ facts }) ? 'menu' : 'primary'),
    run: ({ facts, env }) =>
      requestReview({
        getState: env.getState,
        sessionId: facts.sessionId,
        request: { kind: 'fix', threadIds: [facts.threadId] },
      }),
  },
];
