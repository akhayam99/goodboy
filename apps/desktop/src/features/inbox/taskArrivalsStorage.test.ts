import { afterEach, describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { markSeenAt, noteFirstSeen, EMPTY_TASK_ARRIVALS } from './taskArrivals';
import { readTaskArrivals, writeTaskArrivals } from './taskArrivalsStorage';

const workspaceId = brandId<WorkspaceId>({ value: 'workspace-harborline' });
const KEY = 'goodboy:task-arrivals:v1:workspace-harborline';

afterEach(() => {
  localStorage.clear();
});

describe('task arrivals storage', () => {
  it('starts empty and never looked until something was written', () => {
    const arrivals = readTaskArrivals({ workspaceId });

    expect(arrivals.seenAt).toBeNull();
    expect(arrivals.firstSeen.size).toBe(0);
  });

  it('survives a reload: the first-seen stamps and the look come back as written', () => {
    const written = markSeenAt({
      arrivals: noteFirstSeen({
        arrivals: EMPTY_TASK_ARRIVALS,
        keys: ['github:issue:acme/ledger-core#12', 'jira:NW-7'],
        now: 1_000,
      }),
      now: 2_000,
    });
    writeTaskArrivals({ workspaceId, arrivals: written });

    const reloaded = readTaskArrivals({ workspaceId });

    expect(reloaded.seenAt).toBe(2_000);
    expect(Object.fromEntries(reloaded.firstSeen)).toEqual({
      'github:issue:acme/ledger-core#12': 1_000,
      'jira:NW-7': 1_000,
    });
  });

  it('keeps each workspace apart', () => {
    writeTaskArrivals({
      workspaceId,
      arrivals: markSeenAt({ arrivals: EMPTY_TASK_ARRIVALS, now: 5 }),
    });

    const other = readTaskArrivals({ workspaceId: brandId<WorkspaceId>({ value: 'workspace-b' }) });

    expect(other.seenAt).toBeNull();
  });

  it('ignores a corrupted value and a malformed entry instead of throwing', () => {
    localStorage.setItem(KEY, 'not json');
    expect(readTaskArrivals({ workspaceId }).seenAt).toBeNull();

    localStorage.setItem(
      KEY,
      JSON.stringify({ seenAt: 9, firstSeen: [['ok', 3], ['bad'], [1, 2], ['nan', 'x']] }),
    );
    const arrivals = readTaskArrivals({ workspaceId });

    expect(arrivals.seenAt).toBe(9);
    expect(Object.fromEntries(arrivals.firstSeen)).toEqual({ ok: 3 });
  });
});
