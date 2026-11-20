import { insertPrReviewDraft } from '@goodboy/db';
import type { IsoDateTime, PrReviewDraft, ReviewDraftSide, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import type { ReviewTarget } from './resolveReviewTarget';
import type { SetFn } from './types';

export type AddReviewDraftInput = {
  readonly sessionId: SessionId;
  readonly target: ReviewTarget;
  readonly path: string;
  readonly line: number;
  readonly startLine?: number | null;
  readonly side?: ReviewDraftSide;
  readonly body: string;
};

export const addReviewDraft = (set: SetFn) => {
  return async (input: AddReviewDraftInput): Promise<PrReviewDraft> => {
    const { target } = input;
    const draft: PrReviewDraft = {
      id: crypto.randomUUID(),
      sessionId: input.sessionId,
      provider: target.provider,
      repo: target.repo,
      prNumber: target.prNumber,
      path: input.path,
      line: input.line,
      startLine: input.startLine ?? null,
      side: input.side ?? 'new',
      body: input.body,
      status: 'draft',
      stale: false,
      origin: 'user',
      createdAt: new Date().toISOString() as IsoDateTime,
    };
    await insertPrReviewDraft({ db: tauriDatabase, draft });
    set((state) => ({
      reviewDrafts: {
        ...state.reviewDrafts,
        [input.sessionId]: [...(state.reviewDrafts[input.sessionId] ?? []), draft],
      },
    }));
    return draft;
  };
};
