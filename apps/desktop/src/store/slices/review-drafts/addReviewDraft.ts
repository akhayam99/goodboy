import { insertPrReviewDraft } from '@goodboy/db';
import type { IsoDateTime, PrReviewDraft, ReviewDraftSide, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveReviewTarget } from './resolveReviewTarget';
import type { GetFn, SetFn } from './types';

export type AddReviewDraftInput = {
  readonly sessionId: SessionId;
  readonly path: string;
  readonly line: number;
  readonly startLine?: number | null;
  readonly side?: ReviewDraftSide;
  readonly body: string;
};

export const addReviewDraft = (set: SetFn, get: GetFn) => {
  return async (input: AddReviewDraftInput): Promise<PrReviewDraft> => {
    const target = resolveReviewTarget({ state: get(), sessionId: input.sessionId });
    if (target == null) {
      throw new Error('no linked pull request or merge request for this session');
    }
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
