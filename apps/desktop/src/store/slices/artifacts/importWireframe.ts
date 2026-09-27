import type { ArtifactId, SessionArtifact, SessionId } from '@goodboy/types';
import { createArtifact, updateArtifactSource } from '../../../features/artifacts/artifacts';
import type { WireframeFidelity } from '../../../features/wireframes/wireframeFidelity';
import { refreshSessionArtifacts } from './refresh';
import type { GetFn, SetFn } from './types';

export type ImportWireframeParams = {
  readonly sessionId: SessionId;
  readonly title: string;
  readonly sourceText: string;
  readonly fidelity: WireframeFidelity;
};

export const IMPORTED_AGENT_NAME = 'Wireframe';

export const importWireframe = (set: SetFn, get: GetFn) => {
  return async ({
    sessionId,
    title,
    sourceText,
    fidelity,
  }: ImportWireframeParams): Promise<SessionArtifact> => {
    const agentId = await get().spawnAgent(sessionId, {
      name: IMPORTED_AGENT_NAME,
      kindOverride: 'wireframe',
      focus: 'none',
    });
    const artifact = await createArtifact({
      sessionId,
      agentId,
      kind: 'wireframe',
      schemaVersion: 1,
      title,
      sourceFormat: 'json',
      sourceText,
      metadata: { fidelity, designProfile: {} },
      sourceTurnId: `import-${crypto.randomUUID()}`,
      note: { author: 'import' },
    });
    await refreshSessionArtifacts(set, sessionId);
    return artifact;
  };
};

export type ReplaceWireframeSpecParams = {
  readonly sessionId: SessionId;
  readonly artifact: SessionArtifact;
  readonly sourceText: string;
};

export const replaceWireframeSpec = (set: SetFn) => {
  return async ({ sessionId, artifact, sourceText }: ReplaceWireframeSpecParams) => {
    await updateArtifactSource({
      artifactId: artifact.id as ArtifactId,
      title: artifact.title,
      sourceFormat: artifact.sourceFormat,
      sourceText,
      metadata: artifact.metadata,
      note: { author: 'import' },
    });
    await refreshSessionArtifacts(set, sessionId);
  };
};
