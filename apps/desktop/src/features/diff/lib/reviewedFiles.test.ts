// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import type { FileDiff, MountId, SessionId } from '@goodboy/types';
import { fileSignature, readReviewedMap, viewedStateOf, writeReviewedMap } from './reviewedFiles';

const SESSION = 'session-1' as SessionId;
const LEDGER_MOUNT = 'mount-ledger' as MountId;
const RELAY_MOUNT = 'mount-relay' as MountId;
const BRANCH = { kind: 'branch' } as const;

const fileAt = (extra: Partial<FileDiff> = {}): FileDiff => ({
  path: 'src/ledger/ledger.ts',
  status: 'modified',
  additions: 3,
  deletions: 1,
  binary: false,
  hunks: [
    {
      header: '@@ -1,4 +1,6 @@',
      oldStart: 1,
      oldLines: 4,
      newStart: 1,
      newLines: 6,
      lines: [],
    },
  ],
  ...extra,
});

afterEach(() => {
  localStorage.clear();
});

describe('fileSignature', () => {
  it('changes with the status, the counts and the hunks', () => {
    const base = fileSignature(fileAt());

    expect(fileSignature(fileAt())).toBe(base);
    expect(fileSignature(fileAt({ additions: 4 }))).not.toBe(base);
    expect(fileSignature(fileAt({ status: 'renamed' }))).not.toBe(base);
    expect(fileSignature(fileAt({ hunks: [] }))).not.toBe(base);
  });
});

describe('viewedStateOf', () => {
  it('is none until marked, viewed on the same signature and stale once the file changed', () => {
    const file = fileAt();
    const map = { [file.path]: fileSignature(file) };

    expect(viewedStateOf(file, {})).toBe('none');
    expect(viewedStateOf(file, map)).toBe('viewed');
    expect(viewedStateOf(fileAt({ deletions: 9 }), map)).toBe('stale');
  });
});

describe('reviewed map storage', () => {
  it('keeps one map per mount of the same session and view', () => {
    const file = fileAt();
    writeReviewedMap(SESSION, BRANCH, { [file.path]: fileSignature(file) }, LEDGER_MOUNT);

    expect(viewedStateOf(file, readReviewedMap(SESSION, BRANCH, LEDGER_MOUNT))).toBe('viewed');
    expect(viewedStateOf(file, readReviewedMap(SESSION, BRANCH, RELAY_MOUNT))).toBe('none');
  });

  it('keeps one map per view', () => {
    const file = fileAt();
    writeReviewedMap(SESSION, BRANCH, { [file.path]: fileSignature(file) }, LEDGER_MOUNT);

    const working = readReviewedMap(SESSION, { kind: 'working', scope: 'all' }, LEDGER_MOUNT);

    expect(viewedStateOf(file, working)).toBe('none');
  });

  it('reads what was saved before mounts had their own key until the mount saves its own', () => {
    const file = fileAt();
    writeReviewedMap(SESSION, BRANCH, { [file.path]: fileSignature(file) });

    expect(viewedStateOf(file, readReviewedMap(SESSION, BRANCH, LEDGER_MOUNT))).toBe('viewed');

    writeReviewedMap(SESSION, BRANCH, {}, LEDGER_MOUNT);

    expect(viewedStateOf(file, readReviewedMap(SESSION, BRANCH, LEDGER_MOUNT))).toBe('none');
  });

  it('saves nothing without a session', () => {
    writeReviewedMap(null, BRANCH, { 'a.ts': 'x' }, LEDGER_MOUNT);

    expect(readReviewedMap(null, BRANCH, LEDGER_MOUNT)).toEqual({});
    expect(localStorage.length).toBe(0);
  });
});
