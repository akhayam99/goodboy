import { CircleCheck, RefreshCw, RotateCcw, Send, SkipForward, Undo2 } from '@goodboy/ui/icons';
import { COMMENT_RUN_COPY } from '../../resolve/commentRunCopy';
import { NEEDS_RUN_COPY } from '../../resolve/needsRunCopy';
import { remoteActionLabel } from '../../resolve/reviewRemote';
import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import { requestReview } from '../../review/reviewRequest';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { agentPlace } from '../../../store/slices/navigation/place';
import type { ObjectKindDefinition, ReviewCommentActionTarget } from '../types';
import type { ReviewCommentFacts } from './reviewComment';
import { hasOverlay, isRunChanged, isRunFinished } from './reviewCommentRules';
import { NAMES } from '../../../shared/utils/names';

const JOINABLE: ReadonlySet<ReviewCommentState> = new Set(['new', 'needs', 'failed']);

const CLOSED_NOTE: ReadonlySet<ReviewCommentState> = new Set(['resolved', 'pushed']);

type FactsParams = {
  readonly facts: ReviewCommentFacts;
};

const isRunFirst = ({ facts }: FactsParams): boolean =>
  facts.lane === 'run' && facts.state === 'new' && facts.canStartRun;

const isFree = ({ facts }: FactsParams): boolean =>
  facts.lane !== 'in_run' && facts.remote === null;

const isSuggestingRun = ({ facts }: FactsParams): boolean =>
  facts.runSuggestion !== null && facts.state === 'failed' && facts.remote === null;

export const REVIEW_COMMENT_RUN_ACTIONS: ObjectKindDefinition<
  ReviewCommentActionTarget,
  ReviewCommentFacts
>['actions'] = [
  {
    id: 'reviewComment.openRun',
    label: COMMENT_RUN_COPY.openRun,
    icon: CONCEPT_ICONS.runs,
    group: 'open',
    when: ({ facts }) => facts.runAgentId !== null && !isRunChanged({ facts }),
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
    description: ({ facts }) =>
      isSuggestingRun({ facts }) ? NEEDS_RUN_COPY.startRunDetail : COMMENT_RUN_COPY.startRunNote,
    when: ({ facts }) =>
      (facts.state === 'new' || facts.state === 'failed') && facts.canStartRun && isFree({ facts }),
    slot: ({ facts }) => (isRunFirst({ facts }) || isSuggestingRun({ facts }) ? 'primary' : 'menu'),
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
  {
    id: 'reviewComment.draft',
    label: ({ facts }) => (isRunFirst({ facts }) ? COMMENT_RUN_COPY.fixAsOne : NAMES.fix),
    icon: CONCEPT_ICONS.agents,
    group: 'act',
    shortcut: 'review.fix',
    description: ({ facts }) => (isRunFirst({ facts }) ? COMMENT_RUN_COPY.fixAsOneNote : null),
    when: ({ facts }) =>
      facts.state === 'new' &&
      (isFree({ facts }) || (isRunFinished({ facts }) && !hasOverlay({ facts }))),
    slot: ({ facts }) => (isRunFirst({ facts }) || isRunFinished({ facts }) ? 'menu' : 'primary'),
    run: ({ facts, env }) =>
      requestReview({
        getState: env.getState,
        sessionId: facts.sessionId,
        request: { kind: 'fix', threadIds: [facts.threadId] },
      }),
  },
  {
    id: 'reviewComment.addToRun',
    label: COMMENT_RUN_COPY.addToRun,
    ariaLabel: ({ facts }) =>
      COMMENT_RUN_COPY.addToRunNamed({ title: facts.joinRuns[0]?.name ?? '' }),
    description: ({ facts }) => facts.joinRuns[0]?.name ?? null,
    icon: CONCEPT_ICONS.auto,
    group: 'act',
    when: ({ facts }) =>
      facts.joinRuns.length > 0 && JOINABLE.has(facts.state) && !hasOverlay({ facts }),
    slot: () => 'menu',
    run: async ({ facts, env }) => {
      const [run] = facts.joinRuns;
      if (run === undefined) {
        return;
      }
      await env.getState().addToCommentRun({
        sessionId: facts.sessionId,
        agentId: run.agentId,
        threadId: facts.threadId,
        quote: facts.quote,
      });
      env.showToast({ kind: 'success', message: COMMENT_RUN_COPY.added({ title: run.name }) });
    },
  },
  {
    id: 'reviewComment.resolveRunNote',
    label: COMMENT_RUN_COPY.resolveNote,
    icon: CircleCheck,
    group: 'act',
    shortcut: 'review.accept',
    when: ({ facts }) => facts.isNote && isRunFinished({ facts }),
    slot: () => 'primary',
    run: ({ facts, env }) =>
      env.getState().closeResolvedNote({ sessionId: facts.sessionId, threadId: facts.threadId }),
  },
  {
    id: 'reviewComment.replyFromRun',
    label: ({ facts }) =>
      COMMENT_RUN_COPY.hostVerb({
        verb: remoteActionLabel({ action: 'replyAndResolve', canResolve: facts.canResolve }),
        label: facts.provider,
      }),
    icon: CircleCheck,
    group: 'act',
    shortcut: 'review.accept',
    when: ({ facts }) =>
      !facts.isNote && facts.hasPr && isRunFinished({ facts }) && !hasOverlay({ facts }),
    blockedReason: ({ facts }) => (facts.runReply.trim() === '' ? COMMENT_RUN_COPY.noReply : null),
    slot: () => 'primary',
    run: ({ facts, env }) =>
      env.getState().replyFromCommentRun({
        sessionId: facts.sessionId,
        threadId: facts.threadId,
        mountId: facts.runMountId,
        reply: facts.runReply,
      }),
  },
  {
    id: 'reviewComment.reopenRunNote',
    label: COMMENT_RUN_COPY.reopen,
    icon: Undo2,
    group: 'act',
    shortcut: 'review.undo',
    when: ({ facts }) =>
      facts.isNote &&
      facts.runEnd !== null &&
      CLOSED_NOTE.has(facts.state) &&
      facts.noteId !== null,
    slot: () => 'secondary',
    run: ({ facts, env }) =>
      facts.noteId === null
        ? undefined
        : env.getState().reopenDiffComment(facts.sessionId, facts.noteId),
  },
  {
    id: 'reviewComment.keepOpen',
    label: COMMENT_RUN_COPY.keepOpen,
    icon: SkipForward,
    group: 'act',
    shortcut: 'review.skip',
    when: ({ facts }) => isRunFinished({ facts }),
    slot: () => 'secondary',
    run: ({ facts, env }) =>
      env.getState().deferResolveQueueItem({ sessionId: facts.sessionId, itemId: facts.itemId }),
  },
  {
    id: 'reviewComment.sendChangeToRun',
    label: COMMENT_RUN_COPY.sendChange,
    icon: Send,
    group: 'act',
    when: ({ facts }) => isRunChanged({ facts }),
    slot: () => 'primary',
    run: async ({ facts, env }) => {
      if (facts.runAgentId === null) {
        return;
      }
      await env.getState().sendChangeToCommentRun({
        sessionId: facts.sessionId,
        agentId: facts.runAgentId,
        threadId: facts.threadId,
        quote: facts.changedQuote,
      });
      env.showToast({
        kind: 'success',
        message: COMMENT_RUN_COPY.changeSent({ title: facts.runTitle }),
      });
    },
  },
  {
    id: 'reviewComment.keepRunAsIs',
    label: COMMENT_RUN_COPY.keepRunAsIs,
    icon: SkipForward,
    group: 'act',
    when: ({ facts }) => isRunChanged({ facts }),
    slot: () => 'secondary',
    run: ({ facts, env }) =>
      env.getState().settleResolveSourceChange({
        sessionId: facts.sessionId,
        threadId: facts.threadId,
        keepDraft: false,
      }),
  },
];
