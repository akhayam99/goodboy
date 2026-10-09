import {
  Check,
  CircleCheck,
  CornerDownRight,
  Cpu,
  ExternalLink,
  FileCode,
  Link,
  MessageCircleQuestion,
  OctagonX,
  PenLine,
  RefreshCw,
  Send,
  SkipForward,
  TextCursorInput,
  Undo2,
} from 'lucide-react';
import type { AgentId, ResolveVerdict, SessionId } from '@goodboy/types';
import { REVIEW_SOURCE_CAPABILITIES, REVIEW_SOURCE_LABEL } from '@goodboy/core';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import {
  branchPlace,
  fixRunTranscript,
  sessionPlace,
} from '../../../store/slices/navigation/place';
import { activeReviewSourceOf } from '../../../store/slices/review-source/activeReviewSource';
import { acceptReviewItem } from '../../resolve/acceptReviewItem';
import { laneAcceptCountOf } from '../../resolve/laneAcceptCount';
import { acceptUpToLabel } from '../../resolve/laneCopy';
import { FAILED_RUN_COPY } from '../../resolve/failedRunCopy';
import { verdictReply } from '../../resolve/commentVerdict';
import { postReplyWhenNothingWaits } from '../../resolve/replyDelivery';
import { replyOf, reviewRowsOf, rowStateOf } from '../../resolve/reviewRows';
import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import { REMOTE_LABEL, commitUrlOf, remoteActionLabel, remoteOf } from '../../resolve/reviewRemote';
import type {
  ThreadGitFacts,
  ThreadRemoteKind,
} from '../../../store/slices/resolve/threadGitState';
import { requestReview, type ReviewComposeMode } from '../../review/reviewRequest';
import type { AppStore } from '../../../store/store';
import type { ActionEnv, ObjectKindDefinition, ReviewCommentActionTarget } from '../types';
import { NAMES } from '../../../shared/names';

export type ReviewCommentFacts = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly itemId: string;
  readonly revision: number;
  readonly state: ReviewCommentState;
  readonly isNote: boolean;
  readonly hasPr: boolean;
  readonly provider: string;
  readonly canResolve: boolean;
  readonly agentId: AgentId | null;
  readonly path: string | null;
  readonly url: string | null;
  readonly reply: string;
  readonly approval: 'none' | 'accepted' | 'wont_fix' | 'deferred';
  readonly remote: ThreadRemoteKind | null;
  readonly elsewhereSha: string | null;
  readonly prUrl: string | null;
  readonly verdict: ResolveVerdict | null;
  readonly isChecking: boolean;
  readonly isPushedMissing: boolean;
  readonly remoteReply: string | null;
  readonly isReplyOnly: boolean;
  readonly isReplyFailure: boolean;
  readonly hasFixOnBranch: boolean;
  readonly laneAcceptCount: number;
};

const UNDECIDED: ReadonlySet<ReviewCommentState> = new Set([
  'new',
  'needs',
  'ready',
  'edited',
  'outdated',
  'failed',
]);
const DRAFTED: ReadonlySet<ReviewCommentState> = new Set(['ready', 'edited', 'outdated']);
const DECIDED: ReadonlySet<ReviewCommentState> = new Set(['accepted', 'replied', 'skipped']);

const hasOverlay = ({ facts }: { readonly facts: ReviewCommentFacts }): boolean =>
  facts.remote !== null;

const isMissing = ({ facts }: { readonly facts: ReviewCommentFacts }): boolean =>
  facts.remote === 'missing';

const canRepostVerdict = ({ facts }: { readonly facts: ReviewCommentFacts }): boolean =>
  isMissing({ facts }) && !facts.isChecking && !facts.isPushedMissing;

const shortOf = ({ sha }: { readonly sha: string | null }): string => (sha ?? '').slice(0, 7);

const remoteReplyOf = ({
  gitFacts,
  draftReply,
}: {
  readonly gitFacts: ThreadGitFacts | null;
  readonly draftReply: string | null;
}): string | null => {
  if (draftReply !== null && draftReply.trim() !== '') {
    return draftReply;
  }
  const verdict = gitFacts?.verdict ?? null;
  return verdict === null || verdict.kind === 'refix' ? null : verdictReply({ verdict });
};

const REWRITABLE: ReadonlySet<ReviewCommentState> = new Set(['ready', 'edited']);

const isPostableReplyOnly = ({ facts }: { readonly facts: ReviewCommentFacts }): boolean =>
  facts.state === 'replied' && facts.isReplyOnly && facts.hasPr && !facts.isNote;

const isRedraft = ({ state }: { readonly state: ReviewCommentState }): boolean =>
  state === 'outdated' || state === 'failed';

const editLabel = ({ state }: { readonly state: ReviewCommentState }): string => {
  if (state === 'outdated') {
    return 'Redraft with the new comment';
  }
  return isRedraft({ state }) ? 'Redraft' : 'Edit';
};

type RunParams = {
  readonly facts: ReviewCommentFacts;
  readonly env: ActionEnv;
};

const compose = ({ facts, env }: RunParams, mode: ReviewComposeMode) =>
  requestReview({
    getState: env.getState,
    sessionId: facts.sessionId,
    request: { kind: 'compose', threadId: facts.threadId, mode },
  });

const accept = async ({ facts, env }: RunParams): Promise<void> => {
  await acceptReviewItem({
    state: env.getState(),
    sessionId: facts.sessionId,
    threadId: facts.threadId,
    itemId: facts.itemId,
    revision: facts.revision,
    reply: facts.reply,
    isNote: facts.isNote,
    hasPr: facts.hasPr,
  });
  await postReplyWhenNothingWaits({
    getState: env.getState,
    sessionId: facts.sessionId,
    threadId: facts.threadId,
  });
};

const undo = async ({ facts, env }: RunParams): Promise<void> => {
  const state = env.getState();
  if (facts.approval === 'accepted') {
    await state.reopenResolveQueueItem({
      sessionId: facts.sessionId,
      itemId: facts.itemId,
      revision: facts.revision,
    });
    return;
  }
  await state.takeUpResolveQueueItem({ sessionId: facts.sessionId, itemId: facts.itemId });
};

const isRechecking = ({
  state,
  sessionId,
  threadId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly threadId: string;
}): boolean => {
  const recheck = state.sessionThreadRechecks?.[sessionId]?.[threadId] ?? null;
  return recheck !== null && recheck.error === null;
};

export const REVIEW_COMMENT_KIND: ObjectKindDefinition<
  ReviewCommentActionTarget,
  ReviewCommentFacts
> = {
  noun: 'comment',
  facts: ({ state, target }) => {
    const row =
      reviewRowsOf({ state, sessionId: target.sessionId }).find(
        (candidate) => candidate.thread.threadId === target.threadId,
      ) ?? null;
    if (row === null) {
      return null;
    }
    const draft = state.resolveItemDrafts[target.sessionId]?.[target.threadId];
    const rowState = rowStateOf({ state, sessionId: target.sessionId, row });
    const gitFacts = state.sessionThreadGit?.[target.sessionId]?.[target.threadId] ?? null;
    return {
      sessionId: target.sessionId,
      threadId: target.threadId,
      itemId: row.item.id,
      revision: row.thread.revision,
      state: rowState,
      isNote: row.thread.originKind === 'diff_comment',
      hasPr: activeReviewSourceOf({ state, sessionId: target.sessionId }) !== null,
      provider: REVIEW_SOURCE_LABEL[row.thread.sourceKind ?? 'github'],
      canResolve: REVIEW_SOURCE_CAPABILITIES[row.thread.sourceKind ?? 'github'].canResolve,
      agentId: row.attempt?.agentId ?? null,
      path: row.reviewerNote?.path ?? null,
      url: row.commentThread?.head.url ?? null,
      reply: replyOf({ draft, row }),
      approval: row.item.approvalState,
      remote: remoteOf({ state: rowState, facts: gitFacts }),
      elsewhereSha: gitFacts?.elsewhere?.sha ?? null,
      prUrl: state.sessionGithub[target.sessionId]?.pr?.url ?? null,
      verdict: gitFacts?.verdict ?? null,
      isChecking: isRechecking({ state, sessionId: target.sessionId, threadId: target.threadId }),
      isPushedMissing: gitFacts?.missing?.wasPushed === true,
      remoteReply: remoteReplyOf({ gitFacts, draftReply: draft?.reply ?? null }),
      isReplyOnly:
        row.item.approvalState === 'wont_fix' ||
        (row.proposalKind !== 'fix' && row.thread.disposition !== 'fix'),
      isReplyFailure: row.thread.stateReason?.startsWith('publication_failed:') === true,
      hasFixOnBranch:
        row.thread.disposition === 'fix' &&
        (row.thread.commitShas?.length ?? 0) > 0 &&
        !(state.sessionResolveCandidates[target.sessionId] ?? []).some(
          (entry) =>
            entry.candidate.state === 'ready' &&
            entry.items.some((member) => member.queueItemId === row.item.id),
        ),
      laneAcceptCount: laneAcceptCountOf({
        candidates: state.sessionResolveCandidates[target.sessionId] ?? [],
        itemId: row.item.id,
      }),
    };
  },
  actions: [
    {
      id: 'reviewComment.openInDiff',
      label: `Open in ${NAMES.files}`,
      icon: FileCode,
      group: 'open',
      when: ({ facts }) => facts.path !== null,
      slot: () => 'menu',
      run: ({ facts, env }) =>
        env.getState().navigate({
          to: branchPlace({
            sessionId: facts.sessionId,
            tab: 'files',
            focus: { kind: 'branch', path: facts.path ?? '' },
          }),
        }),
    },
    {
      id: 'reviewComment.transcript',
      label: ({ facts }) => (facts.state === 'failed' ? 'Open transcript' : 'Agent transcript'),
      icon: CONCEPT_ICONS.agents,
      group: 'open',
      when: ({ facts }) => facts.agentId !== null,
      slot: () => 'menu',
      run: ({ facts, env }) => {
        if (facts.agentId === null) {
          return;
        }
        env.getState().navigate(
          fixRunTranscript({
            sessionId: facts.sessionId,
            agentId: facts.agentId,
            threadId: facts.threadId,
          }),
        );
      },
    },
    {
      id: 'reviewComment.openOnGithub',
      label: ({ facts }) => `Open on ${facts.provider}`,
      icon: ExternalLink,
      group: 'open',
      when: ({ facts }) => facts.url !== null,
      slot: () => 'menu',
      run: ({ facts }) => (facts.url === null ? undefined : openUrl(facts.url)),
    },
    {
      id: 'reviewComment.replyAndResolve',
      label: ({ facts }) => {
        const label = remoteActionLabel({
          action: 'replyAndResolve',
          canResolve: facts.canResolve,
        });
        return facts.verdict?.kind === 'fixed_elsewhere' && facts.verdict.sha !== null
          ? `${label} with ${shortOf({ sha: facts.verdict.sha })}`
          : label;
      },
      icon: CircleCheck,
      group: 'act',
      shortcut: 'review.reply',
      when: ({ facts }) =>
        facts.remote === 'on_origin' ||
        facts.remote === 'looks_fixed' ||
        (canRepostVerdict({ facts }) && facts.verdict?.kind === 'fixed_elsewhere'),
      slot: () => 'primary',
      run: ({ facts, env }) =>
        env.getState().replyAndResolveThread({
          sessionId: facts.sessionId,
          threadId: facts.threadId,
          ...(facts.remote !== 'on_origin' &&
            facts.remote !== 'looks_fixed' &&
            facts.remoteReply !== null && { reply: facts.remoteReply }),
        }),
    },
    {
      id: 'reviewComment.closeWithReply',
      label: ({ facts }) =>
        remoteActionLabel({ action: 'closeWithReply', canResolve: facts.canResolve }),
      icon: CircleCheck,
      group: 'act',
      shortcut: 'review.accept',
      when: ({ facts }) => canRepostVerdict({ facts }) && facts.verdict?.kind === 'obsolete',
      blockedReason: ({ facts }) =>
        facts.remoteReply === null ? 'There is no reply to close with.' : null,
      slot: () => 'primary',
      run: ({ facts, env }) =>
        facts.remoteReply === null
          ? undefined
          : env.getState().replyAndResolveThread({
              sessionId: facts.sessionId,
              threadId: facts.threadId,
              reply: facts.remoteReply,
            }),
    },
    {
      id: 'reviewComment.recheck',
      label: ({ facts }) =>
        facts.verdict === null ? REMOTE_LABEL.recheck : REMOTE_LABEL.lookAgain,
      icon: RefreshCw,
      group: 'act',
      when: ({ facts }) =>
        isMissing({ facts }) &&
        !facts.isChecking &&
        (facts.verdict === null || facts.verdict.kind === 'fixed_elsewhere'),
      slot: ({ facts }) => (facts.verdict === null ? 'primary' : 'secondary'),
      run: async ({ facts, env }) => {
        await env.getState().recheckThread({
          sessionId: facts.sessionId,
          threadId: facts.threadId,
        });
      },
    },
    {
      id: 'reviewComment.fixAgain',
      label: ({ facts }) =>
        facts.verdict?.kind === 'obsolete' ? REMOTE_LABEL.fixAnyway : REMOTE_LABEL.fixAgain,
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      shortcut: 'review.fix',
      when: ({ facts }) =>
        isMissing({ facts }) && !facts.isChecking && facts.verdict?.kind !== 'fixed_elsewhere',
      slot: ({ facts }) => (facts.verdict?.kind === 'refix' ? 'primary' : 'secondary'),
      run: ({ facts, env }) =>
        requestReview({
          getState: env.getState,
          sessionId: facts.sessionId,
          request: { kind: 'fix', threadIds: [facts.threadId] },
        }),
    },
    {
      id: 'reviewComment.addHint',
      label: REMOTE_LABEL.addHint,
      icon: TextCursorInput,
      group: 'act',
      when: ({ facts }) => isMissing({ facts }) && facts.verdict?.kind === 'refix',
      slot: () => 'secondary',
      run: (params) => compose(params, 'redraft'),
    },
    {
      id: 'reviewComment.resolveOnly',
      label: REMOTE_LABEL.resolveOnly,
      icon: CircleCheck,
      group: 'act',
      shortcut: 'review.accept',
      when: ({ facts }) => facts.remote === 'you_replied' && facts.canResolve,
      slot: () => 'primary',
      run: ({ facts, env }) =>
        env.getState().resolveThreadOnly({
          sessionId: facts.sessionId,
          threadId: facts.threadId,
        }),
    },
    {
      id: 'reviewComment.fixAnyway',
      label: REMOTE_LABEL.fixAnyway,
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      shortcut: 'review.fix',
      when: ({ facts }) => facts.remote === 'looks_fixed' && facts.elsewhereSha !== null,
      slot: () => 'secondary',
      run: ({ facts, env }) => {
        if (facts.elsewhereSha === null) {
          return;
        }
        env.getState().dismissThreadFix({
          sessionId: facts.sessionId,
          threadId: facts.threadId,
          sha: facts.elsewhereSha,
        });
      },
    },
    {
      id: 'reviewComment.openCommit',
      label: REMOTE_LABEL.openCommit,
      icon: ExternalLink,
      group: 'open',
      when: ({ facts }) =>
        facts.remote === 'looks_fixed' &&
        facts.elsewhereSha !== null &&
        commitUrlOf({ prUrl: facts.prUrl, sha: facts.elsewhereSha }) !== null,
      slot: () => 'secondary',
      run: ({ facts }) => {
        const url =
          facts.elsewhereSha === null
            ? null
            : commitUrlOf({ prUrl: facts.prUrl, sha: facts.elsewhereSha });
        return url === null ? undefined : openUrl(url);
      },
    },
    {
      id: 'reviewComment.draft',
      label: 'Fix',
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      shortcut: 'review.fix',
      when: ({ facts }) => facts.state === 'new' && !hasOverlay({ facts }),
      slot: () => 'primary',
      run: ({ facts, env }) =>
        requestReview({
          getState: env.getState,
          sessionId: facts.sessionId,
          request: { kind: 'fix', threadIds: [facts.threadId] },
        }),
    },
    {
      id: 'reviewComment.answer',
      label: 'Answer',
      icon: MessageCircleQuestion,
      group: 'act',
      shortcut: 'review.edit',
      when: ({ facts }) => facts.state === 'needs' && !hasOverlay({ facts }),
      slot: () => 'primary',
      run: (params) => compose(params, 'answer'),
    },
    {
      id: 'reviewComment.accept',
      label: ({ facts }) => acceptUpToLabel({ count: facts.laneAcceptCount }),
      icon: Check,
      group: 'act',
      shortcut: 'review.accept',
      when: ({ facts }) =>
        DRAFTED.has(facts.state) && facts.state !== 'outdated' && !hasOverlay({ facts }),
      slot: () => 'primary',
      run: accept,
    },
    {
      id: 'reviewComment.keepDraft',
      label: 'Keep the draft',
      icon: Check,
      group: 'act',
      when: ({ facts }) => facts.state === 'outdated' && !hasOverlay({ facts }),
      slot: () => 'secondary',
      run: ({ facts, env }) =>
        env.getState().settleResolveSourceChange({
          sessionId: facts.sessionId,
          threadId: facts.threadId,
          keepDraft: true,
        }),
    },
    {
      id: 'reviewComment.edit',
      label: ({ facts }) => {
        if (facts.state === 'failed') {
          return 'Add a hint';
        }
        return editLabel(facts);
      },
      icon: RefreshCw,
      group: 'act',
      shortcut: 'review.edit',
      when: ({ facts }) =>
        (DRAFTED.has(facts.state) || facts.state === 'failed') && !hasOverlay({ facts }),
      slot: ({ facts }) => (isRedraft(facts) ? 'primary' : 'menu'),
      run: (params) => compose(params, isRedraft(params.facts) ? 'redraft' : 'edit'),
    },
    {
      id: 'reviewComment.anotherModel',
      label: FAILED_RUN_COPY.anotherModel,
      icon: Cpu,
      group: 'act',
      when: ({ facts }) => facts.state === 'failed' && !hasOverlay({ facts }),
      slot: () => 'menu',
      run: ({ facts, env }) =>
        requestReview({
          getState: env.getState,
          sessionId: facts.sessionId,
          request: { kind: 'model', threadId: facts.threadId },
        }),
    },
    {
      id: 'reviewComment.editReply',
      label: 'Edit reply',
      icon: TextCursorInput,
      group: 'act',
      when: ({ facts }) =>
        ((facts.state === 'ready' || facts.state === 'edited') && !hasOverlay({ facts })) ||
        isPostableReplyOnly({ facts }) ||
        (canRepostVerdict({ facts }) &&
          (facts.verdict?.kind === 'fixed_elsewhere' || facts.verdict?.kind === 'obsolete')),
      slot: ({ facts }) =>
        facts.state === 'ready' || facts.state === 'edited' ? 'secondary' : 'hover',
      run: async ({ facts, env }) => {
        if (facts.state === 'replied') {
          await undo({ facts, env });
        }
        requestReview({
          getState: env.getState,
          sessionId: facts.sessionId,
          request: { kind: 'edit_reply', threadId: facts.threadId },
        });
      },
    },
    {
      id: 'reviewComment.rewriteReply',
      label: 'Rewrite reply',
      icon: PenLine,
      group: 'act',
      when: ({ facts }) =>
        facts.isReplyOnly &&
        (REWRITABLE.has(facts.state) || isPostableReplyOnly({ facts })) &&
        !facts.isNote &&
        !hasOverlay({ facts }),
      slot: () => 'menu',
      run: (params) => compose(params, 'rewrite'),
    },
    {
      id: 'reviewComment.fixItAnyway',
      label: 'Fix it anyway',
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      when: ({ facts }) =>
        facts.isReplyOnly &&
        (facts.state === 'ready' || facts.state === 'edited' || facts.state === 'replied') &&
        !facts.isNote &&
        !hasOverlay({ facts }),
      slot: () => 'menu',
      run: (params) => compose(params, 'fixAnyway'),
    },
    {
      id: 'reviewComment.replyOnly',
      label: 'Reply only',
      icon: CornerDownRight,
      group: 'act',
      when: ({ facts }) =>
        !facts.isReplyOnly &&
        !facts.hasFixOnBranch &&
        (facts.state === 'ready' || facts.state === 'edited') &&
        !facts.isNote &&
        !hasOverlay({ facts }),
      slot: () => 'menu',
      run: async ({ facts, env }) => {
        await env
          .getState()
          .switchToReplyOnly({ sessionId: facts.sessionId, threadId: facts.threadId });
        env.showToast({
          kind: 'success',
          message: 'Change dropped. This comment gets a reply only.',
        });
      },
    },
    {
      id: 'reviewComment.postReplyNow',
      label: ({ facts }) => (facts.state === 'failed' ? 'Retry' : 'Post reply now'),
      icon: Send,
      group: 'act',
      when: ({ facts }) =>
        !facts.isNote &&
        facts.hasPr &&
        facts.isReplyOnly &&
        !hasOverlay({ facts }) &&
        (facts.state === 'replied' || (facts.state === 'failed' && facts.isReplyFailure)),
      slot: () => 'menu',
      run: ({ facts, env }) =>
        env.getState().publishThreadNow({ sessionId: facts.sessionId, threadId: facts.threadId }),
    },
    {
      id: 'reviewComment.reply',
      label: ({ facts }) => (facts.state === 'failed' ? 'Reply yourself' : 'Reply'),
      icon: CornerDownRight,
      group: 'act',
      shortcut: 'review.reply',
      when: ({ facts }) => UNDECIDED.has(facts.state) && !facts.isNote && !hasOverlay({ facts }),
      slot: () => 'secondary',
      run: (params) => compose(params, 'reply'),
    },
    {
      id: 'reviewComment.skip',
      label: 'Skip',
      icon: SkipForward,
      group: 'act',
      shortcut: 'review.skip',
      when: ({ facts }) =>
        UNDECIDED.has(facts.state) ||
        (isMissing({ facts }) && !facts.isPushedMissing && !facts.isChecking),
      slot: () => 'secondary',
      run: ({ facts, env }) =>
        env.getState().deferResolveQueueItem({ sessionId: facts.sessionId, itemId: facts.itemId }),
    },
    {
      id: 'reviewComment.undo',
      label: ({ facts }) => (facts.state === 'skipped' ? 'Resume' : 'Undo'),
      icon: Undo2,
      group: 'act',
      shortcut: 'review.undo',
      when: ({ facts }) => DECIDED.has(facts.state),
      slot: () => 'secondary',
      run: undo,
    },
    {
      id: 'reviewComment.stop',
      label: 'Stop drafting',
      icon: OctagonX,
      group: 'act',
      when: ({ facts }) => facts.state === 'drafting' && facts.agentId !== null,
      slot: () => 'menu',
      run: ({ facts, env }) =>
        facts.agentId === null
          ? undefined
          : env.getState().forceCloseResolver(facts.sessionId, facts.agentId),
    },
    {
      id: 'reviewComment.resolveNoReply',
      label: ({ facts }) => (facts.isNote ? 'Close the note' : 'Resolve without a reply'),
      icon: CircleCheck,
      group: 'act',
      when: ({ facts }) => UNDECIDED.has(facts.state) && facts.canResolve,
      slot: () => 'menu',
      run: ({ facts, env }) =>
        facts.isNote
          ? env.getState().closeResolvedNote({
              sessionId: facts.sessionId,
              threadId: facts.threadId,
            })
          : env
              .getState()
              .resolveWithoutReply({ sessionId: facts.sessionId, itemId: facts.itemId }),
    },
    {
      id: 'reviewComment.copyLink',
      label: 'Copy link',
      icon: Link,
      group: 'copy',
      when: ({ facts }) => facts.url !== null,
      slot: () => 'menu',
      run: ({ facts, env }) => (facts.url === null ? undefined : env.copyText({ text: facts.url })),
    },
  ],
};
