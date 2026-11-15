import { describe, expect, it } from 'vitest';
import { brandId, type WorkspaceId } from '@goodboy/types';
import { selectToolUseCount } from './selectToolUseCount';

const HARBORLINE = brandId<WorkspaceId>({ value: 'harborline' });
const NORTHWIND = brandId<WorkspaceId>({ value: 'northwind' });

const state = {
  toolUseCounts: {
    [HARBORLINE]: { github: { pullRequests: 6, reviews: 3, issues: 0 } },
  },
};

describe('selectToolUseCount', () => {
  it('reads one count of one tool in one workspace', () => {
    expect(
      selectToolUseCount({ state, workspaceId: HARBORLINE, tool: 'github', use: 'reviews' }),
    ).toBe(3);
  });

  it('keeps a zero as a number', () => {
    expect(
      selectToolUseCount({ state, workspaceId: HARBORLINE, tool: 'github', use: 'issues' }),
    ).toBe(0);
  });

  it('is unknown before Tasks has counted, for that tool or that workspace', () => {
    expect(
      selectToolUseCount({ state, workspaceId: HARBORLINE, tool: 'gitlab', use: 'issues' }),
    ).toBeNull();
    expect(
      selectToolUseCount({ state, workspaceId: NORTHWIND, tool: 'github', use: 'reviews' }),
    ).toBeNull();
  });
});
