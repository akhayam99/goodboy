import type { ExtractedReviewComment } from '@goodboy/core';
import { insertPrReviewDraft } from '@goodboy/db';
import type {
  AgentId,
  DiffCommentAnchor,
  IsoDateTime,
  PrReviewDraft,
  SessionId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolveReviewTarget } from './resolveReviewTarget';
import type { GetFn, SetFn } from './types';

type NotesParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly markers: ReadonlyArray<ExtractedReviewComment>;
};

const anchorOf = ({ marker }: { readonly marker: ExtractedReviewComment }): DiffCommentAnchor =>
  marker.startLine !== null && marker.startLine < marker.line
    ? { side: marker.side, lineNumber: marker.startLine, endLineNumber: marker.line }
    : { side: marker.side, lineNumber: marker.line };

const keepAsNotes = async ({ get, sessionId, agentId, markers }: NotesParams): Promise<void> => {
  await get().loadDiffComments(sessionId);
  const existing = get().diffComments[sessionId] ?? [];
  const seen = new Set(existing.map((note) => `${note.filePath}:${note.body}`));
  for (const marker of markers) {
    const key = `${marker.path}:${marker.body}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    await get().addDiffComment(sessionId, marker.path, marker.body, anchorOf({ marker }), {
      kind: 'agent',
      agentId,
    });
  }
};

export const queueAgentReviewComments = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    agentId: AgentId,
    markers: ReadonlyArray<ExtractedReviewComment>,
  ): Promise<void> => {
    if (markers.length === 0) {
      return;
    }
    const target = resolveReviewTarget({ state: get(), sessionId });
    if (target == null) {
      await keepAsNotes({ get, sessionId, agentId, markers });
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
