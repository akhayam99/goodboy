import { describe, expect, it } from 'vitest';
import type { ArtifactId, SessionId } from '@goodboy/types';
import { artifactPrintHash, artifactPrintRequest } from './artifactPrintRequest';

const request = {
  sessionId: 'session-1' as SessionId,
  artifactId: 'artifact-1' as ArtifactId,
};

describe('artifactPrintRequest', () => {
  it('round trips through the window hash', () => {
    expect(artifactPrintRequest({ hash: `#${artifactPrintHash(request)}` })).toEqual(request);
  });

  it('ignores a normal workspace hash', () => {
    expect(artifactPrintRequest({ hash: '#ws=workspace-1' })).toBeNull();
  });

  it('ignores an incomplete print hash', () => {
    expect(artifactPrintRequest({ hash: '#print=artifact&session=session-1' })).toBeNull();
    expect(artifactPrintRequest({ hash: '#print=artifact&session=&artifact=a' })).toBeNull();
  });
});
