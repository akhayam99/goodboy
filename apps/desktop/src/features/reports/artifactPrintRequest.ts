import type { ArtifactId, SessionId } from '@goodboy/types';

export const ARTIFACT_PRINT_MODE = 'artifact';

export type ArtifactWindowMode = 'print' | 'read';

export type ArtifactPrintRequest = Readonly<{
  sessionId: SessionId;
  artifactId: ArtifactId;
  mode: ArtifactWindowMode;
}>;

export const artifactPrintHash = ({
  sessionId,
  artifactId,
  mode,
}: ArtifactPrintRequest): string => {
  const base = `print=${ARTIFACT_PRINT_MODE}&session=${encodeURIComponent(sessionId)}&artifact=${encodeURIComponent(artifactId)}`;
  return mode === 'read' ? `${base}&mode=read` : base;
};

export const artifactPrintRequest = ({
  hash,
}: {
  readonly hash: string;
}): ArtifactPrintRequest | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('print') !== ARTIFACT_PRINT_MODE) {
    return null;
  }
  const sessionId = params.get('session');
  const artifactId = params.get('artifact');
  if (sessionId === null || artifactId === null || sessionId === '' || artifactId === '') {
    return null;
  }
  return {
    sessionId: sessionId as SessionId,
    artifactId: artifactId as ArtifactId,
    mode: params.get('mode') === 'read' ? 'read' : 'print',
  };
};
