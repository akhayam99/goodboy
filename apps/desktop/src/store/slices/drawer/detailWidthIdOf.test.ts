import { describe, expect, it } from 'vitest';
import { brandId, type ArtifactId, type SessionId } from '@goodboy/types';
import { detailWidthIdOf } from './detailWidthIdOf';
import type { OpenDrawer } from './state';

const SESSION_ID = brandId<SessionId>({ value: 'session-1' });

const REPORT = brandId<ArtifactId>({ value: 'artifact-report' });

const PLAN = brandId<ArtifactId>({ value: 'artifact-plan' });

type ArtifactParams = {
  readonly artifactId: ArtifactId;
  readonly tab: 'details' | 'chat';
};

type DocumentParams = {
  readonly artifactId: ArtifactId;
  readonly revision: number | null;
};

const artifact = ({ artifactId, tab }: ArtifactParams): OpenDrawer => ({
  kind: 'artifact',
  sessionId: SESSION_ID,
  payload: { artifactId, tab },
});

const artifactDocument = ({ artifactId, revision }: DocumentParams): OpenDrawer => ({
  kind: 'artifact-document',
  sessionId: SESSION_ID,
  payload: { artifactId, revision },
});

describe('detailWidthIdOf', () => {
  it('gives each artifact a width of its own, kept across its tabs', () => {
    const report = detailWidthIdOf({ drawer: artifact({ artifactId: REPORT, tab: 'details' }) });

    expect(report).toBe('artifact:artifact-report');
    expect(detailWidthIdOf({ drawer: artifact({ artifactId: PLAN, tab: 'details' }) })).not.toBe(
      report,
    );
    expect(detailWidthIdOf({ drawer: artifact({ artifactId: REPORT, tab: 'chat' }) })).toBe(report);
  });

  it('gives each artifact document a width of its own, kept across its revisions', () => {
    const plan = detailWidthIdOf({
      drawer: artifactDocument({ artifactId: PLAN, revision: null }),
    });

    expect(plan).toBe('artifact-document:artifact-plan');
    expect(
      detailWidthIdOf({ drawer: artifactDocument({ artifactId: REPORT, revision: null }) }),
    ).not.toBe(plan);
    expect(detailWidthIdOf({ drawer: artifactDocument({ artifactId: PLAN, revision: 2 }) })).toBe(
      plan,
    );
  });

  it('keeps one width per kind for every other detail, and none when no detail is open', () => {
    expect(detailWidthIdOf({ drawer: { kind: 'ask', sessionId: SESSION_ID, payload: null } })).toBe(
      'ask',
    );
    expect(detailWidthIdOf({ drawer: null })).toBeNull();
  });
});
