import { formatError } from '@goodboy/ui';
import type { ArtifactId, SessionId, WireframeArtifact } from '@goodboy/types';
import {
  annotateArtifactRevision,
  listArtifactsForSession,
} from '../../../features/artifacts/artifacts';
import { buildWireframeChangeRequest } from '../../../features/wireframes/buildWireframeChangeRequest';
import {
  draftFailure,
  type WireframeDraft,
  type WireframeDraftRequest,
} from '../../../features/wireframes/wireframeDraft';
import type { GetFn, SetFn } from './types';

export type RequestWireframeChangeParams = WireframeDraftRequest & {
  readonly sessionId: SessionId;
  readonly artifact: WireframeArtifact;
  readonly screenTitle: string | null;
};

const putDraft = ({
  set,
  artifactId,
  draft,
}: {
  readonly set: SetFn;
  readonly artifactId: ArtifactId;
  readonly draft: WireframeDraft | null;
}) =>
  set((state) => {
    const next = { ...state.wireframeDrafts };
    if (draft === null) {
      delete next[artifactId];
      return { wireframeDrafts: next };
    }
    return { wireframeDrafts: { ...next, [artifactId]: draft } };
  });

export const requestWireframeChange = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    artifact,
    screenTitle,
    ask,
    scope,
    screenId,
    picked,
  }: RequestWireframeChangeParams): Promise<void> => {
    const request: WireframeDraftRequest = { ask, scope, screenId, picked };
    const startedAt = Date.now();
    const base = { ...request, fromRevision: artifact.revision, startedAt };
    putDraft({ set, artifactId: artifact.id, draft: { ...base, status: 'drafting' } });
    const content = buildWireframeChangeRequest({
      title: artifact.title,
      revision: artifact.revision,
      ask,
      scope,
      screen: screenId === null ? null : { id: screenId, title: screenTitle ?? screenId },
      picked,
      sourceText: artifact.sourceText,
    });
    try {
      await get().sendTurn({ sessionId, agentId: artifact.agentId, content });
    } catch (cause) {
      putDraft({
        set,
        artifactId: artifact.id,
        draft: {
          ...base,
          status: 'failed',
          reason: 'The request did not reach the agent.',
          detail: formatError(cause),
        },
      });
      return;
    }
    const artifacts = await listArtifactsForSession(sessionId).catch(() => null);
    if (artifacts !== null) {
      set((state) => ({ sessionArtifacts: { ...state.sessionArtifacts, [sessionId]: artifacts } }));
    }
    const landed = artifacts?.find((entry) => entry.id === artifact.id) ?? null;
    if (landed !== null && landed.revision > artifact.revision) {
      await annotateArtifactRevision({
        artifactId: artifact.id,
        revision: landed.revision,
        note: {
          author: 'agent',
          ask: ask.trim(),
          pinned: { scope, screenId, nodes: picked },
        },
      }).catch(() => false);
      putDraft({
        set,
        artifactId: artifact.id,
        draft: { ...base, status: 'ready', toRevision: landed.revision, settledAt: Date.now() },
      });
      return;
    }
    const failure = draftFailure({
      events: get().transcripts[artifact.agentId] ?? [],
      since: startedAt,
    });
    putDraft({ set, artifactId: artifact.id, draft: { ...base, status: 'failed', ...failure } });
  };
};

export const settleWireframeDraft = (set: SetFn) => {
  return (artifactId: ArtifactId): void => putDraft({ set, artifactId, draft: null });
};
