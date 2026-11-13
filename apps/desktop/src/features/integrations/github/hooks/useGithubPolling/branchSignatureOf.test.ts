import { describe, expect, it } from 'vitest';
import type { Session } from '@goodboy/types';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import { buildStorySession } from '../../../../../store/storyHarness';
import { branchSignatureOf } from './branchSignatureOf';

type ReadingParams = {
  readonly session: Session;
};

const reading = ({ session }: ReadingParams): { sessions: Session[]; reads: () => number } => {
  let count = 0;
  const watched = new Proxy(session, {
    get: (target, key) => {
      if (key === 'id') {
        count += 1;
      }
      return Reflect.get(target, key);
    },
  });
  return { sessions: [watched], reads: () => count };
};

describe('the branch signature', () => {
  it('names each session with its branch', () => {
    const session = buildStorySession({ id: nextSessionId(), workspaceId: nextWorkspaceId() });

    expect(branchSignatureOf({ sessions: [session], branches: { [session.id]: 'main' } })).toBe(
      `${session.id}@main;`,
    );
  });

  it('loops over no session again while the sessions and the branches are the same objects', () => {
    const session = buildStorySession({ id: nextSessionId(), workspaceId: nextWorkspaceId() });
    const { sessions, reads } = reading({ session });
    const branches = { [session.id]: 'main' };

    branchSignatureOf({ sessions, branches });
    const afterFirst = reads();
    branchSignatureOf({ sessions, branches });
    branchSignatureOf({ sessions, branches });

    expect(afterFirst).toBeGreaterThan(0);
    expect(reads()).toBe(afterFirst);
  });

  it('reads the sessions again when a branch changes', () => {
    const session = buildStorySession({ id: nextSessionId(), workspaceId: nextWorkspaceId() });
    const sessions = [session];

    const before = branchSignatureOf({ sessions, branches: { [session.id]: 'main' } });
    const after = branchSignatureOf({ sessions, branches: { [session.id]: 'ak/fix' } });

    expect(after).not.toBe(before);
  });
});
