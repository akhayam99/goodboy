import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import type { ObjectKindDefinition, TaskListActionTarget } from '../types';

export type TaskListFacts = {
  readonly isRefreshing: boolean;
  readonly onRefresh: () => void;
  readonly onManageTools: () => void;
};

export const TASK_LIST_KIND: ObjectKindDefinition<TaskListActionTarget, TaskListFacts> = {
  noun: 'tasks',
  facts: ({ target }) => target.facts,
  actions: [
    {
      id: 'taskList.refresh',
      label: ({ facts }) => (facts.isRefreshing ? 'Refreshing tasks' : 'Refresh tasks'),
      icon: CONCEPT_ICONS.refresh,
      group: 'act',
      blockedReason: ({ facts }) => (facts.isRefreshing ? 'A refresh is already running' : null),
      when: () => true,
      run: ({ facts }) => {
        if (facts.isRefreshing) {
          return 'unchanged';
        }
        facts.onRefresh();
        return 'done';
      },
    },
    {
      id: 'taskList.manageTools',
      label: 'Manage tools',
      icon: CONCEPT_ICONS.integrations,
      group: 'act',
      when: () => true,
      run: ({ facts }) => facts.onManageTools(),
    },
  ],
};
