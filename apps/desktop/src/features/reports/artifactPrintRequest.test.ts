import { describe, expect, it } from 'vitest';
import type { ArtifactId, SessionId } from '@goodboy/types';
import {
  artifactPrintHash,
  artifactPrintRequest,
  type ArtifactPrintRequest,
} from './artifactPrintRequest';

const request: ArtifactPrintRequest = {
  sessionId: 'session-1' as SessionId,
  artifactId: 'artifact-1' as ArtifactId,
  mode: 'print',
};

describe('artifactPrintRequest', () => {
  it('round trips through the window hash', () => {
    expect(artifactPrintRequest({ hash: `#${artifactPrintHash(request)}` })).toEqual(request);
  });

  it('round trips the read mode and keeps the print hash unchanged', () => {
    const read: ArtifactPrintRequest = { ...request, mode: 'read' };
    expect(artifactPrintHash(read)).toBe(
      'print=artifact&session=session-1&artifact=artifact-1&mode=read',
    );
    expect(artifactPrintHash(request)).toBe('print=artifact&session=session-1&artifact=artifact-1');
    expect(artifactPrintRequest({ hash: `#${artifactPrintHash(read)}` })).toEqual(read);
  });

  it('prints when the mode is missing or unknown', () => {
    expect(
      artifactPrintRequest({ hash: '#print=artifact&session=s&artifact=a&mode=edit' })?.mode,
    ).toBe('print');
  });

  it('ignores a normal workspace hash', () => {
    expect(artifactPrintRequest({ hash: '#ws=workspace-1' })).toBeNull();
  });

  it('ignores an incomplete print hash', () => {
    expect(artifactPrintRequest({ hash: '#print=artifact&session=session-1' })).toBeNull();
    expect(artifactPrintRequest({ hash: '#print=artifact&session=&artifact=a' })).toBeNull();
  });
});
