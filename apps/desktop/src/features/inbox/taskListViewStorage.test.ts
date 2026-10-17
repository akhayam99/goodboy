import { afterEach, describe, expect, it } from 'vitest';
import { nextWorkspaceId } from '@goodboy/types/testing';
import { readTaskListView, writeTaskListView } from './taskListViewStorage';

const DEFAULT_TASK_LIST_VIEW = { scope: 'for-me', groupBy: 'source' };

const workspaceId = nextWorkspaceId();
const otherWorkspaceId = nextWorkspaceId();
const KEY = `goodboy:task-list-view:v1:${workspaceId}`;

afterEach(() => {
  localStorage.clear();
});

describe('task list view storage', () => {
  it('opens on For me grouped by source when nothing was saved', () => {
    expect(readTaskListView({ workspaceId })).toEqual(DEFAULT_TASK_LIST_VIEW);
  });

  it('round-trips the scope and the grouping per workspace', () => {
    writeTaskListView({ workspaceId, view: { scope: 'all', groupBy: 'status' } });

    expect(readTaskListView({ workspaceId })).toEqual({ scope: 'all', groupBy: 'status' });
    expect(readTaskListView({ workspaceId: otherWorkspaceId })).toEqual(DEFAULT_TASK_LIST_VIEW);
  });

  it('falls back on a corrupted value instead of throwing', () => {
    localStorage.setItem(KEY, JSON.stringify({ scope: 'mine', groupBy: 'color' }));

    expect(readTaskListView({ workspaceId })).toEqual(DEFAULT_TASK_LIST_VIEW);
  });
});
