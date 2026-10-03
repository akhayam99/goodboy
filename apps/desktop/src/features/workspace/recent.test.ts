// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { IsoDateTime, Workspace } from '@goodboy/types';
import { aWorkspace } from '@goodboy/types/testing';
import { workspacesByDigit } from './recent';

const workspace = (name: string, lastAccessedAt: string | null): Workspace =>
  aWorkspace({
    name,
    ...(lastAccessedAt !== null && { lastAccessedAt: lastAccessedAt as IsoDateTime }),
  });

const ALPHA = workspace('alpha', '2026-09-01T10:00:00Z');

const WORKSPACES = [
  ALPHA,
  workspace('bravo', '2026-09-03T10:00:00Z'),
  workspace('charlie', null),
  workspace('delta', '2026-09-02T10:00:00Z'),
];

describe('workspacesByDigit', () => {
  it('orders the other workspaces from the most recent, the same list the switcher shows', () => {
    const names = workspacesByDigit({
      workspaces: WORKSPACES,
      currentId: ALPHA.id,
      limit: 9,
    }).map((entry) => entry.name);

    expect(names).toEqual(['bravo', 'delta', 'charlie']);
  });

  it('keeps every workspace when none is open', () => {
    const names = workspacesByDigit({ workspaces: WORKSPACES, currentId: null, limit: 9 }).map(
      (entry) => entry.name,
    );

    expect(names).toEqual(['bravo', 'delta', 'alpha', 'charlie']);
  });

  it('stops at the number of digit keys', () => {
    expect(workspacesByDigit({ workspaces: WORKSPACES, currentId: null, limit: 2 })).toHaveLength(
      2,
    );
  });
});
