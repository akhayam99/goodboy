import { CircleCheck, Send, SkipForward, Undo2 } from '@goodboy/ui/icons';
import { COMMENT_RUN_COPY } from '../../resolve/commentRunCopy';
import { remoteActionLabel } from '../../resolve/reviewRemote';
import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ObjectKindDefinition, ReviewCommentActionTarget } from '../types';
import type { ReviewCommentFacts } from './reviewComment';
import { hasOverlay, isRunChanged, isRunFinished } from './reviewCommentRules';

const JOINABLE: ReadonlySet<ReviewCommentState> = new Set(['new', 'needs', 'failed']);

const CLOSED_NOTE: ReadonlySet<ReviewCommentState> = new Set(['resolved', 'pushed']);

export const REVIEW_COMMENT_RUN_ACTIONS: ObjectKindDefinition<
  ReviewCommentActionTarget,
  ReviewCommentFacts
>['actions'] = [
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
