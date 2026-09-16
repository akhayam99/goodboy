import type { ArtifactId, SessionId } from '@goodboy/types';

export const ARTIFACT_PRINT_MODE = 'artifact';

export type ArtifactPrintRequest = Readonly<{
  sessionId: SessionId;
  artifactId: ArtifactId;
}>;

export const artifactPrintHash = ({ sessionId, artifactId }: ArtifactPrintRequest): string =>
  `print=${ARTIFACT_PRINT_MODE}&session=${encodeURIComponent(sessionId)}&artifact=${encodeURIComponent(artifactId)}`;

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
  return { sessionId: sessionId as SessionId, artifactId: artifactId as ArtifactId };
};
