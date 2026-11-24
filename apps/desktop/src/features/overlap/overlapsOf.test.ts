import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { overlapsOf } from './overlapsOf';
import type { LiveMount } from './readLiveMounts';

const LEDGER = brandId<ProjectId>({ value: 'project-ledger' });
const RELAY = brandId<ProjectId>({ value: 'project-relay' });

type MountParams = {
  readonly mountId: string;
  readonly sessionId: string;
  readonly projectId?: ProjectId;
  readonly paths: ReadonlyArray<string>;
};

const mount = ({ mountId, sessionId, projectId = LEDGER, paths }: MountParams): LiveMount => ({
  mountId: brandId<MountId>({ value: mountId }),
  sessionId: brandId<SessionId>({ value: sessionId }),
  projectId,
  branch: `hl/${mountId}`,
  createdAt: 1,
  port: null,
  hasFixedPort: false,
  paths,
});

const retry = mount({
  mountId: 'retry',
  sessionId: 's-398',
  paths: ['src/retry/state.ts', 'src/retry/backoff.ts', 'README.md'],
});
const batch = mount({
  mountId: 'batch',
  sessionId: 's-412',
  paths: ['src/retry/state.ts', 'src/batch/a.ts', 'src/batch/b.ts'],
});

describe('overlapsOf', () => {
  it('finds an overlap only when two mounts of one project share a file', () => {
    const elsewhere = mount({
      mountId: 'relay',
      sessionId: 's-500',
      projectId: RELAY,
      paths: ['src/retry/state.ts'],
    });
    const apart = mount({ mountId: 'docs', sessionId: 's-501', paths: ['docs/notes.md'] });
    const mounts = [retry, batch, elsewhere, apart];

    const found = overlapsOf({ mounts, mountId: 'batch' });

    expect(found.map((overlap) => [overlap.other.mountId, overlap.paths])).toEqual([
      ['retry', ['src/retry/state.ts']],
    ]);
    expect(overlapsOf({ mounts, mountId: 'docs' })).toEqual([]);
    expect(overlapsOf({ mounts, mountId: 'relay' })).toEqual([]);
  });

  it('finds nothing for a mount without changes or without a project', () => {
    const clean = mount({ mountId: 'clean', sessionId: 's-1', paths: [] });
    const loose = { ...retry, mountId: brandId<MountId>({ value: 'loose' }), projectId: null };

    expect(overlapsOf({ mounts: [clean, retry], mountId: 'clean' })).toEqual([]);
    expect(overlapsOf({ mounts: [loose, retry], mountId: 'loose' })).toEqual([]);
  });
});
