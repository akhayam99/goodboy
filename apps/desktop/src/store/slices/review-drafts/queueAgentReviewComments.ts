import type { ExtractedReviewComment } from '@goodboy/core';
import { insertPrReviewDraft } from '@goodboy/db';
import type { AgentId, IsoDateTime, PrReviewDraft, SessionId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveReviewTarget } from './resolveReviewTarget';
import type { GetFn, SetFn } from './types';

export const queueAgentReviewComments = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    _agentId: AgentId,
    markers: ReadonlyArray<ExtractedReviewComment>,
  ): Promise<void> => {
    if (markers.length === 0) {
      return;
    }
    const target = resolveReviewTarget({ get, sessionId });
    if (target == null) {
      return;
    }
    const existing = get().reviewDrafts[sessionId] ?? [];
    const seen = new Set(existing.map((draft) => `${draft.path}:${draft.line}:${draft.body}`));
    const created: PrReviewDraft[] = [];
    for (const marker of markers) {
      const key = `${marker.path}:${marker.line}:${marker.body}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const draft: PrReviewDraft = {
        id: crypto.randomUUID(),
        sessionId,
        provider: target.provider,
        repo: target.repo,
        prNumber: target.prNumber,
        path: marker.path,
        line: marker.line,
        startLine: marker.startLine,
        side: marker.side,
        body: marker.body,
        status: 'draft',
        stale: false,
        origin: 'agent',
        createdAt: new Date().toISOString() as IsoDateTime,
      };
      await insertPrReviewDraft({ db: tauriDatabase, draft });
      created.push(draft);
    }
    if (created.length === 0) {
      return;
    }
    set((state) => ({
      reviewDrafts: {
        ...state.reviewDrafts,
        [sessionId]: [...(state.reviewDrafts[sessionId] ?? []), ...created],
      },
    }));
  };
};
