import { describe, expect, it } from 'vitest';
import { brandId, type MountId, type ProjectId, type SessionId } from '@goodboy/types';
import { mergeOrderOf } from './mergeOrderOf';
import { overlapsOf } from './overlapsOf';
import { overlapWordsOf } from './overlapWordsOf';
import type { LiveMount } from './readLiveMounts';

const LEDGER = brandId<ProjectId>({ value: 'project-ledger' });
const RELAY = brandId<ProjectId>({ value: 'project-relay' });

type MountParams = {
  readonly mountId: string;
  readonly sessionId: string;
  readonly projectId?: ProjectId;
  readonly paths: ReadonlyArray<string>;
  readonly createdAt?: number;
  readonly branch?: string;
};

const mount = ({
  mountId,
  sessionId,
  projectId = LEDGER,
  paths,
  createdAt = 1,
  branch = `hl/${mountId}`,
}: MountParams): LiveMount => ({
  mountId: brandId<MountId>({ value: mountId }),
  sessionId: brandId<SessionId>({ value: sessionId }),
  projectId,
  branch,
  createdAt,
  port: null,
  hasFixedPort: false,
  paths,
});

const retry = mount({
  mountId: 'retry',
  sessionId: 's-398',
  paths: ['src/retry/state.ts', 'src/retry/backoff.ts', 'README.md'],
  createdAt: 1,
});
const batch = mount({
  mountId: 'batch',
  sessionId: 's-412',
  paths: [
    'src/retry/state.ts',
    'src/batch/a.ts',
    'src/batch/b.ts',
    'src/batch/c.ts',
    'src/batch/d.ts',
    'src/batch/e.ts',
    'src/batch/f.ts',
  ],
  createdAt: 2,
});
const LABELS = new Map([
  [brandId<SessionId>({ value: 's-398' }), 'HBL-398'],
  [brandId<SessionId>({ value: 's-412' }), 'HBL-412'],
]);

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

describe('mergeOrderOf and overlapWordsOf', () => {
  it('proposes the branch with fewer files first and names the shared file', () => {
    const [overlap] = overlapsOf({ mounts: [retry, batch], mountId: 'batch' });
    if (overlap === undefined) {
      throw new Error('expected an overlap');
    }

    expect(mergeOrderOf({ overlap }).first.mountId).toBe('retry');
    expect(overlapWordsOf({ overlap, sessionLabels: LABELS })).toEqual({
      chip: 'Overlaps HBL-398',
      files: 'Both branches change src/retry/state.ts.',
      order: 'Merge HBL-398 first: it changes 3 files, HBL-412 changes 7.',
    });
  });

  it('breaks a tie with the older mount and counts the other shared files', () => {
    const older = mount({
      mountId: 'a',
      sessionId: 's-398',
      paths: ['x.ts', 'y.ts'],
      createdAt: 1,
    });
    const newer = mount({
      mountId: 'b',
      sessionId: 's-412',
      paths: ['x.ts', 'y.ts'],
      createdAt: 5,
    });
    const [overlap] = overlapsOf({ mounts: [older, newer], mountId: 'a' });
    if (overlap === undefined) {
      throw new Error('expected an overlap');
    }

    const words = overlapWordsOf({ overlap, sessionLabels: LABELS });

    expect(mergeOrderOf({ overlap }).then.mountId).toBe('b');
    expect(words.files).toBe('Both branches change x.ts and 1 more file.');
    expect(words.order).toBe('Merge HBL-398 first: same size, and it started earlier.');
  });

  it('names branches when both mounts belong to one session', () => {
    const left = mount({ mountId: 'l', sessionId: 's-398', paths: ['x.ts'], branch: 'hl/left' });
    const right = mount({
      mountId: 'r',
      sessionId: 's-398',
      paths: ['x.ts', 'y.ts'],
      branch: 'hl/right',
    });
    const [overlap] = overlapsOf({ mounts: [left, right], mountId: 'r' });
    if (overlap === undefined) {
      throw new Error('expected an overlap');
    }

    expect(overlapWordsOf({ overlap, sessionLabels: LABELS }).chip).toBe('Overlaps hl/left');
  });
});
