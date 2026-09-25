import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArtifactId } from '@goodboy/types';

const { markArtifactOpened } = vi.hoisted(() => ({
  markArtifactOpened: vi.fn(async () => undefined),
}));

vi.mock('@goodboy/db', () => ({ markArtifactOpened }));
vi.mock('../../shared/lib/db', () => ({ tauriDatabase: {} }));

import { ARTIFACT_OPENED_DEBOUNCE_MS, recordArtifactOpened } from './recordArtifactOpened';

const artifactId = 'report-1' as ArtifactId;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('recordArtifactOpened', () => {
  it('writes at most once per artifact every ten minutes', async () => {
    expect(await recordArtifactOpened({ artifactId, now: 1000 })).toBe(true);
    expect(await recordArtifactOpened({ artifactId, now: 2000 })).toBe(false);
    expect(
      await recordArtifactOpened({ artifactId, now: 1000 + ARTIFACT_OPENED_DEBOUNCE_MS }),
    ).toBe(true);
    expect(await recordArtifactOpened({ artifactId: 'plan-1' as ArtifactId, now: 2000 })).toBe(
      true,
    );
    expect(markArtifactOpened).toHaveBeenCalledTimes(3);
  });
});
