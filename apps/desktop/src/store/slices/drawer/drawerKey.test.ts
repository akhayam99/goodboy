// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { aSession } from '@goodboy/types/testing';
import { drawerKey } from './drawerKey';
import type { DrawerRequest } from './state';

const SESSION_ID = aSession().id;

type Params = {
  readonly sessionDir: string;
  readonly relPath: string;
};

const exploreFile = ({ sessionDir, relPath }: Params): DrawerRequest => ({
  kind: 'explore-file',
  sessionId: SESSION_ID,
  payload: {
    sessionDir,
    entry: {
      name: relPath.slice(relPath.lastIndexOf('/') + 1),
      relPath,
      isDir: false,
      sizeBytes: 120,
      modifiedAt: null,
    },
  },
});

describe('drawerKey for an Explore file', () => {
  it('differs between two projects for the same relative path', () => {
    const ledger = exploreFile({ sessionDir: '/work/ledger-core', relPath: 'README.md' });
    const notify = exploreFile({ sessionDir: '/work/notify-relay', relPath: 'README.md' });
    expect(drawerKey(ledger)).not.toBe(drawerKey(notify));
  });

  it('differs between two files of one project', () => {
    const readme = exploreFile({ sessionDir: '/work/ledger-core', relPath: 'README.md' });
    const schema = exploreFile({ sessionDir: '/work/ledger-core', relPath: 'docs/schema.md' });
    expect(drawerKey(readme)).not.toBe(drawerKey(schema));
  });

  it('is the same for the same file of the same project', () => {
    const first = exploreFile({ sessionDir: '/work/ledger-core', relPath: 'README.md' });
    const again = exploreFile({ sessionDir: '/work/ledger-core', relPath: 'README.md' });
    expect(drawerKey(first)).toBe(drawerKey(again));
  });
});
