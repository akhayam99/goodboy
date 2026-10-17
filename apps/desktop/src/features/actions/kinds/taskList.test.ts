import { describe, expect, it, vi } from 'vitest';
import { resolveActions } from '../resolveActions';
import type { ActionEnv } from '../types';
import { TASK_LIST_KIND, type TaskListFacts } from './taskList';

type FactsParams = {
  readonly isRefreshing: boolean;
};

const ENV: ActionEnv = {
  getState: () => {
    throw new Error('the tasks list menu reads no store');
  },
  showToast: vi.fn(),
  copyText: async () => undefined,
  origin: 'overflow',
  anchorKey: null,
  viewing: null,
};

const factsOf = ({ isRefreshing }: FactsParams): TaskListFacts => ({
  isRefreshing,
  onRefresh: vi.fn(),
  onManageTools: vi.fn(),
});

describe('tasks list menu', () => {
  it('offers Refresh tasks and Manage tools', () => {
    const resolved = resolveActions({
      definitions: TASK_LIST_KIND.actions,
      facts: factsOf({ isRefreshing: false }),
    });

    expect(resolved.map((action) => [action.label, action.blockedReason])).toEqual([
      ['Refresh tasks', null],
      ['Manage tools', null],
    ]);
  });

  it('blocks a second refresh while one runs, and does not start it', async () => {
    const facts = factsOf({ isRefreshing: true });
    const [refresh] = resolveActions({ definitions: TASK_LIST_KIND.actions, facts });
    const definition = TASK_LIST_KIND.actions.find((action) => action.id === 'taskList.refresh');

    expect(refresh?.label).toBe('Refreshing tasks');
    expect(refresh?.blockedReason).toBe('A refresh is already running');
    expect(await definition?.run({ facts, env: ENV, choice: null })).toBe('unchanged');
    expect(facts.onRefresh).not.toHaveBeenCalled();
  });
});
