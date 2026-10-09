import { ArrowUp, MessageSquarePlus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { isOpenNote, noteThreadId } from '../../resolve/notes/noteThread';
import { notesOnBranchOf } from '../../resolve/notes/notesOnBranchOf';
import {
  moveNotesLabel,
  postNotesResultMessage,
  postNotesToPr,
} from '../../resolve/notes/postNotesToPr';
import { reviewRowsOf, rowStateOf } from '../../resolve/reviewRows';
import {
  activeReviewSourceOf,
  selectedReviewEntryOf,
} from '../../../store/slices/review-source/activeReviewSource';
import { reviewSourceEntriesOf } from '../../../store/slices/review-source/reviewSourceEntries';
import type { ReviewSourceEntry } from '../../../store/slices/review-source/types';
import {
  selectActiveMountId,
  selectDisplayedMount,
} from '../../../store/slices/project-mounts/selectors';
import { isPushFailure } from '../../resolve/reviewCommentState';
import { reviewTallyOf } from '../../resolve/reviewTally';
import { remoteOf } from '../../resolve/reviewRemote';
import { requestReview } from '../../review/reviewRequest';
import {
  targetFromUrl,
  type ReviewTarget,
} from '../../../store/slices/review-drafts/resolveReviewTarget';
import type { AppStore } from '../../../store/store';
import type { ObjectKindDefinition, ReviewActionTarget } from '../types';

export type ReviewFacts = {
  readonly sessionId: SessionId;
  readonly prNumber: number | null;
  readonly sourceKind: 'github' | 'gitlab' | 'bitbucket' | null;
  readonly reviewTarget: ReviewTarget | null;
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

export const draftFixesLabel = ({ fresh }: { readonly fresh: number }): string =>
  fresh === 1 ? 'Draft a fix' : `Draft fixes for ${fresh}`;

const pushLabel = ({
  accepted,
  failed,
}: {
  readonly accepted: number;
  readonly failed: number;
}): string => (failed > 0 ? `Retry push for ${failed}` : `Push ${accepted}`);

const reviewTargetOf = ({
  state,
  sessionId,
}: {
  readonly state: AppStore;
  readonly sessionId: SessionId;
}): ReviewTarget | null => {
  const displayed = selectDisplayedMount({ state, sessionId });
  const activeMountId = selectActiveMountId({ state, sessionId });
  const isOwn = (entry: ReviewSourceEntry): boolean =>
    displayed === null ||
    entry.mountId === displayed.mountId ||
    (entry.mountId === null && displayed.mountId === activeMountId);
  const isReviewable = (entry: ReviewSourceEntry): boolean =>
    (entry.kind === 'github' || entry.kind === 'gitlab') &&
    entry.number !== null &&
    entry.url !== null &&
    isOwn(entry);
  const selected = selectedReviewEntryOf({ state, sessionId });
  const entry =
    selected !== null && isReviewable(selected)
      ? selected
      : reviewSourceEntriesOf({ state, sessionId }).find(isReviewable);
  if (
    entry === undefined ||
    entry.number === null ||
    entry.url === null ||
    (entry.kind !== 'github' && entry.kind !== 'gitlab')
  ) {
    return null;
  }
  return targetFromUrl({ provider: entry.kind, url: entry.url, prNumber: entry.number });
};

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
    const tally = reviewTallyOf({ rows: rows.map((entry) => entry.row) });
    const count = (predicate: (entry: (typeof rows)[number]) => boolean): number =>
      rows.filter(predicate).length;
    const hasPr = source !== null;
    return {
      sessionId,
      prNumber: source?.prNumber ?? null,
      sourceKind: source?.kind ?? null,
      reviewTarget: hasPr ? reviewTargetOf({ state, sessionId }) : null,
      open: count(
        (entry) =>
          ['new', 'drafting', 'needs', 'ready', 'edited', 'outdated'].includes(entry.state) ||
          (entry.state === 'failed' && !isPushFailure({ row: entry.row })) ||
          entry.remote !== null,
      ),
      ready: tally.toReview,
      accepted: tally.readyToPush,
      failed: tally.pushFailed,
      pushed: count((entry) => entry.state === 'pushed'),
      notes: hasPr
        ? notesOnBranchOf({ state, sessionId }).filter((note) => isOpenNote({ note })).length
        : 0,
      isPushing: rows.some((entry) => entry.row.thread.stage === 'publishing'),
      isLoading: source !== null && !source.hasDetail && source.isLoading,
      isError: source !== null && !source.hasDetail && source.error !== null,
    };
  },
  actions: [
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
      id: 'review.postNotes',
      label: ({ facts }) => moveNotesLabel({ count: facts.notes }),
      icon: MessageSquarePlus,
      group: 'act',
      when: ({ facts }) => facts.notes > 0 && facts.reviewTarget !== null,
      slot: () => 'menu',
      run: async ({ facts, env }) => {
        const { reviewTarget } = facts;
        if (reviewTarget === null) {
          return;
        }
        const state = env.getState();
        const result = await postNotesToPr({
          sessionId: facts.sessionId,
          target: reviewTarget,
          notes: notesOnBranchOf({ state, sessionId: facts.sessionId }).filter((note) =>
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
  ],
};
