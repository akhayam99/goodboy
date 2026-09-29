import {
  Check,
  CircleCheck,
  CornerDownRight,
  ExternalLink,
  FileCode,
  Link,
  MessageCircleQuestion,
  OctagonX,
  RefreshCw,
  SkipForward,
  TextCursorInput,
  Undo2,
} from 'lucide-react';
import type { AgentId, ResolveVerdict, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { openUrl } from '../../../shared/lib/editor';
import { resolverPagePlace, sessionPlace } from '../../../store/slices/navigation/place';
import { verdictReply, foldedReply } from '../../resolve/commentVerdict';
import { draftFixes } from '../../resolve/draftFixes';
import { replyOf, reviewRowsOf, rowStateOf } from '../../resolve/reviewRows';
import type { ReviewCommentState } from '../../resolve/reviewCommentState';
import { REMOTE_LABEL, commitUrlOf, remoteOf } from '../../resolve/reviewRemote';
import type {
  ThreadGitFacts,
  ThreadRemoteKind,
} from '../../../store/slices/resolve/threadGitState';
import { requestReview } from '../../review/reviewRequest';
import type { AppStore } from '../../../store/store';
import type { ActionEnv, ObjectKindDefinition, ReviewCommentActionTarget } from '../types';

export type ReviewCommentFacts = {
  readonly sessionId: SessionId;
  readonly threadId: string;
  readonly itemId: string;
  readonly revision: number;
  readonly state: ReviewCommentState;
  readonly isNote: boolean;
  readonly hasPr: boolean;
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
};

export const OUTDATED_REASON = 'The comment changed since this draft. Redraft first.';

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
  if (gitFacts?.folded != null) {
    return foldedReply({ landedAs: gitFacts.folded.landedAs });
  }
  const verdict = gitFacts?.verdict ?? null;
  return verdict === null || verdict.kind === 'refix' ? null : verdictReply({ verdict });
};

const isRedraft = ({ state }: { readonly state: ReviewCommentState }): boolean =>
  state === 'outdated' || state === 'failed';

type RunParams = {
  readonly facts: ReviewCommentFacts;
  readonly env: ActionEnv;
};

const compose = ({ facts, env }: RunParams, mode: 'edit' | 'redraft' | 'answer' | 'reply') =>
  requestReview({
    getState: env.getState,
    sessionId: facts.sessionId,
    request: { kind: 'compose', threadId: facts.threadId, mode },
  });

const accept = async ({ facts, env }: RunParams): Promise<void> => {
  const state = env.getState();
  await state.acceptResolveQueueItem({
    sessionId: facts.sessionId,
    itemId: facts.itemId,
    revision: facts.revision,
    reply: facts.reply,
  });
  if (facts.isNote && !facts.hasPr) {
    await state.closeResolvedNote({ sessionId: facts.sessionId, threadId: facts.threadId });
  }
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
      hasPr: state.sessionGithub[target.sessionId]?.pr != null,
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
    };
  },
  actions: [
    {
      id: 'reviewComment.openInDiff',
      label: 'Open in diff',
      icon: FileCode,
      group: 'open',
      when: ({ facts }) => facts.path !== null,
      slot: () => 'menu',
      run: ({ facts, env }) =>
        env.getState().navigate({
          to: sessionPlace({
            sessionId: facts.sessionId,
            lens: 'files',
            target: {
              kind: 'diff',
              mountPath: null,
              focus: { kind: 'branch', path: facts.path ?? '' },
            },
          }),
        }),
    },
    {
      id: 'reviewComment.transcript',
      label: 'Agent transcript',
      icon: CONCEPT_ICONS.agents,
      group: 'open',
      when: ({ facts }) => facts.agentId !== null,
      slot: () => 'menu',
      run: ({ facts, env }) => {
        if (facts.agentId === null) {
          return;
        }
        env.getState().navigate({
          to: resolverPagePlace({
            sessionId: facts.sessionId,
            agentId: facts.agentId,
            threadId: facts.threadId,
          }),
        });
      },
    },
    {
      id: 'reviewComment.openOnGithub',
      label: 'Open on GitHub',
      icon: ExternalLink,
      group: 'open',
      when: ({ facts }) => facts.url !== null,
      slot: () => 'menu',
      run: ({ facts }) => (facts.url === null ? undefined : openUrl(facts.url)),
    },
    {
      id: 'reviewComment.replyAndResolve',
      label: ({ facts }) =>
        facts.verdict?.kind === 'fixed_elsewhere' && facts.verdict.sha !== null
          ? `${REMOTE_LABEL.replyAndResolve} with ${shortOf({ sha: facts.verdict.sha })}`
          : REMOTE_LABEL.replyAndResolve,
      icon: CircleCheck,
      group: 'act',
      shortcut: 'review.reply',
      when: ({ facts }) =>
        facts.remote === 'on_origin' ||
        facts.remote === 'looks_fixed' ||
        facts.remote === 'folded' ||
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
      label: REMOTE_LABEL.closeWithReply,
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
      shortcut: 'review.draft',
      when: ({ facts }) =>
        isMissing({ facts }) && !facts.isChecking && facts.verdict?.kind !== 'fixed_elsewhere',
      slot: ({ facts }) => (facts.verdict?.kind === 'refix' ? 'primary' : 'secondary'),
      run: async ({ facts, env }) => {
        await draftFixes({
          getState: env.getState,
          sessionId: facts.sessionId,
          threadIds: [facts.threadId],
        });
      },
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
      when: ({ facts }) => facts.remote === 'you_replied',
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
      shortcut: 'review.draft',
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
      label: 'Draft a fix',
      icon: CONCEPT_ICONS.agents,
      group: 'act',
      shortcut: 'review.draft',
      when: ({ facts }) => facts.state === 'new' && !hasOverlay({ facts }),
      slot: () => 'primary',
      run: async ({ facts, env }) => {
        await draftFixes({
          getState: env.getState,
          sessionId: facts.sessionId,
          threadIds: [facts.threadId],
        });
      },
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
      label: 'Accept',
      icon: Check,
      group: 'act',
      shortcut: 'review.accept',
      when: ({ facts }) => DRAFTED.has(facts.state) && !hasOverlay({ facts }),
      blockedReason: ({ facts }) => (facts.state === 'outdated' ? OUTDATED_REASON : null),
      slot: ({ facts }) => (facts.state === 'outdated' ? 'secondary' : 'primary'),
      run: accept,
    },
    {
      id: 'reviewComment.edit',
      label: ({ facts }) => (isRedraft(facts) ? 'Redraft' : 'Edit'),
      icon: RefreshCw,
      group: 'act',
      shortcut: 'review.edit',
      when: ({ facts }) =>
        (DRAFTED.has(facts.state) || facts.state === 'failed') && !hasOverlay({ facts }),
      slot: ({ facts }) => (isRedraft(facts) ? 'primary' : 'secondary'),
      run: (params) => compose(params, isRedraft(params.facts) ? 'redraft' : 'edit'),
    },
    {
      id: 'reviewComment.editReply',
      label: 'Edit the reply',
      icon: TextCursorInput,
      group: 'act',
      when: ({ facts }) =>
        ((facts.state === 'ready' || facts.state === 'edited') && !hasOverlay({ facts })) ||
        (canRepostVerdict({ facts }) &&
          (facts.verdict?.kind === 'fixed_elsewhere' || facts.verdict?.kind === 'obsolete')),
      slot: () => 'hover',
      run: ({ facts, env }) =>
        requestReview({
          getState: env.getState,
          sessionId: facts.sessionId,
          request: { kind: 'edit_reply', threadId: facts.threadId },
        }),
    },
    {
      id: 'reviewComment.reply',
      label: 'Reply',
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
      label: 'Undo',
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
      when: ({ facts }) => UNDECIDED.has(facts.state),
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
