import { ArrowUp, Cpu, MessageSquarePlus, RotateCw } from 'lucide-react';
import type { DiffComment, SessionId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { NAMES } from '../../../shared/names';
import { sessionPlace } from '../../../store/slices/navigation/place';
import { isOpenNote, noteThreadId } from '../../resolve/notes/noteThread';
import {
  POST_NOTES_LABEL,
  postNotesResultMessage,
  postNotesToPr,
} from '../../resolve/notes/postNotesToPr';
import { reviewRowsOf, rowStateOf } from '../../resolve/reviewRows';
import { activeReviewSourceOf } from '../../../store/slices/review-source/activeReviewSource';
import { isPushFailure } from '../../resolve/reviewCommentState';
import { remoteOf } from '../../resolve/reviewRemote';
import { requestReview } from '../../review/reviewRequest';
import type { ObjectKindDefinition, ReviewActionTarget } from '../types';

export type ReviewFacts = {
  readonly sessionId: SessionId;
  readonly prNumber: number | null;
  readonly sourceKind: 'github' | 'gitlab' | 'bitbucket' | null;
  readonly open: number;
  readonly ready: number;
  readonly accepted: number;
  readonly failed: number;
  readonly pushed: number;
  readonly notes: number;
  readonly isPushing: boolean;
  readonly isLoading: boolean;
  readonly isError: boolean;
};

const PUSHING_REASON = 'Pushing now.';

const EMPTY_NOTES: ReadonlyArray<DiffComment> = [];

export const draftFixesLabel = ({ fresh }: { readonly fresh: number }): string =>
  fresh === 1 ? 'Draft a fix' : `Draft fixes for ${fresh}`;

const pushLabel = ({
  accepted,
  failed,
}: {
  readonly accepted: number;
  readonly failed: number;
}): string => (failed > 0 ? `Retry push for ${failed}` : `Push ${accepted}`);

export const REVIEW_KIND: ObjectKindDefinition<ReviewActionTarget, ReviewFacts> = {
  noun: 'review',
  facts: ({ state, target }) => {
    const { sessionId } = target;
    const source = activeReviewSourceOf({ state, sessionId });
    const rows = reviewRowsOf({ state, sessionId }).map((row) => {
      const rowState = rowStateOf({ state, sessionId, row });
      return {
        row,
        state: rowState,
        remote: remoteOf({
          state: rowState,
          facts: state.sessionThreadGit?.[sessionId]?.[row.thread.threadId] ?? null,
        }),
      };
    });
    const count = (predicate: (entry: (typeof rows)[number]) => boolean): number =>
      rows.filter(predicate).length;
    const hasPr = source !== null;
    return {
      sessionId,
      prNumber: source?.prNumber ?? null,
      sourceKind: source?.kind ?? null,
      open: count(
        (entry) =>
          ['new', 'drafting', 'needs', 'ready', 'edited', 'outdated'].includes(entry.state) ||
          (entry.state === 'failed' && !isPushFailure({ row: entry.row })) ||
          entry.remote !== null,
      ),
      ready: count((entry) => entry.state === 'ready' || entry.state === 'edited'),
      accepted: count(
        (entry) =>
          (entry.state === 'accepted' || entry.state === 'replied') && entry.remote !== 'on_origin',
      ),
      failed: count((entry) => entry.state === 'failed' && isPushFailure({ row: entry.row })),
      pushed: count((entry) => entry.state === 'pushed'),
      notes: hasPr
        ? (state.diffComments[sessionId] ?? EMPTY_NOTES).filter((note) => isOpenNote({ note }))
            .length
        : 0,
      isPushing: rows.some((entry) => entry.row.thread.stage === 'publishing'),
      isLoading: source !== null && !source.hasDetail && source.isLoading,
      isError: source !== null && !source.hasDetail && source.error !== null,
    };
  },
  actions: [
    {
      id: 'review.openPullRequest',
      label: ({ facts }) =>
        facts.sourceKind === 'gitlab'
          ? `Open MR !${facts.prNumber ?? ''}`
          : `Open PR #${facts.prNumber ?? ''}`,
      icon: CONCEPT_ICONS.pr,
      group: 'open',
      shortcut: 'lens.pr',
      when: ({ facts }) => facts.prNumber !== null,
      slot: () => 'link',
      run: ({ facts, env }) => {
        const state = env.getState();
        state.setPullRequestMode({ sessionId: facts.sessionId, mode: 'overview' });
        state.navigate({ to: sessionPlace({ sessionId: facts.sessionId, lens: 'pr' }) });
      },
    },
    {
      id: 'review.push',
      label: ({ facts }) => pushLabel(facts),
      icon: ArrowUp,
      group: 'act',
      shortcut: 'composer.submit',
      when: ({ facts }) =>
        facts.prNumber !== null && (facts.accepted > 0 || facts.failed > 0 || facts.isPushing),
      blockedReason: ({ facts }) => (facts.isPushing ? PUSHING_REASON : null),
      slot: ({ facts }) => (facts.open === 0 ? 'primary' : 'secondary'),
      run: ({ facts, env }) =>
        requestReview({
          getState: env.getState,
          sessionId: facts.sessionId,
          request: { kind: 'push' },
        }),
    },
    {
      id: 'review.draftModel',
      label: 'Model for drafts…',
      icon: Cpu,
      group: 'act',
      when: ({ facts }) => !facts.isLoading && !facts.isError,
      slot: () => 'menu',
      run: ({ facts, env }) =>
        requestReview({
          getState: env.getState,
          sessionId: facts.sessionId,
          request: { kind: 'draft_model' },
        }),
    },
    {
      id: 'review.postNotes',
      label: POST_NOTES_LABEL,
      icon: MessageSquarePlus,
      group: 'act',
      when: ({ facts }) => facts.notes > 0 && facts.prNumber !== null,
      slot: () => 'menu',
      run: async ({ facts, env }) => {
        const state = env.getState();
        const result = await postNotesToPr({
          sessionId: facts.sessionId,
          notes: (state.diffComments[facts.sessionId] ?? EMPTY_NOTES).filter((note) =>
            isOpenNote({ note }),
          ),
          addReviewDraft: state.addReviewDraft,
          closeNote: (noteId) =>
            state.closeResolvedNote({
              sessionId: facts.sessionId,
              threadId: noteThreadId({ noteId }),
            }),
        });
        env.showToast({ kind: 'success', message: postNotesResultMessage(result) });
      },
    },
    {
      id: 'review.retryLoad',
      label: NAMES.retry,
      icon: RotateCw,
      group: 'act',
      when: ({ facts }) => facts.isError,
      slot: () => 'empty',
      run: ({ facts, env }) =>
        env.getState().refreshReviewSource({ sessionId: facts.sessionId, force: true }),
    },
  ],
};
