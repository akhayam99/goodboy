import { RefreshCw, RotateCcw } from '@goodboy/ui/icons';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NEEDS_RUN_COPY } from '../../resolve/needsRunCopy';
import { requestReview } from '../../review/reviewRequest';
import type { ActionDefinition } from '../types';
import type { ReviewCommentFacts } from './reviewComment';

type FactsParams = {
  readonly facts: ReviewCommentFacts;
};

const isSuggestingRun = ({ facts }: FactsParams): boolean =>
  facts.runSuggestion !== null && facts.state === 'failed' && facts.remote === null;

export const REVIEW_COMMENT_RUN_ACTIONS: ReadonlyArray<ActionDefinition<ReviewCommentFacts>> = [
  {
    id: 'reviewComment.startRun',
    label: NEEDS_RUN_COPY.startRun,
    icon: CONCEPT_ICONS.runs,
    group: 'act',
    description: () => NEEDS_RUN_COPY.startRunDetail,
    when: isSuggestingRun,
    slot: () => 'primary',
    run: ({ facts, env }) =>
      env.getState().openCommentRunStart({ sessionId: facts.sessionId, threadId: facts.threadId }),
  },
  {
    id: 'reviewComment.retryFix',
    label: NEEDS_RUN_COPY.retryFix,
    icon: RefreshCw,
    group: 'act',
    description: () => NEEDS_RUN_COPY.retryFixDetail,
    when: isSuggestingRun,
    slot: () => 'menu',
    run: ({ facts, env }) =>
      requestReview({
        getState: env.getState,
        sessionId: facts.sessionId,
        request: { kind: 'retry', threadId: facts.threadId },
      }),
  },
  {
    id: 'reviewComment.startOver',
    label: NEEDS_RUN_COPY.startOver,
    icon: RotateCcw,
    group: 'act',
    description: () => NEEDS_RUN_COPY.startOverDetail,
    when: isSuggestingRun,
    slot: () => 'menu',
    run: ({ facts, env }) =>
      requestReview({
        getState: env.getState,
        sessionId: facts.sessionId,
        request: { kind: 'start_over', threadId: facts.threadId },
      }),
  },
];
