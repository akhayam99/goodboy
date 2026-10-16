import { Download, RotateCcw } from 'lucide-react';
import type { ObjectKindDefinition, WorkflowListActionTarget } from '../types';

export type WorkflowListFacts = {
  readonly canRestore: boolean;
  readonly onImport: () => void;
  readonly onRestore: () => void;
};

export const WORKFLOW_LIST_KIND: ObjectKindDefinition<WorkflowListActionTarget, WorkflowListFacts> =
  {
    noun: 'workflows',
    facts: ({ target }) => target.facts,
    actions: [
      {
        id: 'workflowList.import',
        label: 'Import workflows…',
        icon: Download,
        group: 'act',
        when: () => true,
        run: ({ facts }) => facts.onImport(),
      },
      {
        id: 'workflowList.restore',
        label: 'Restore built-in workflows…',
        icon: RotateCcw,
        group: 'act',
        when: ({ facts }) => facts.canRestore,
        run: ({ facts }) => facts.onRestore(),
      },
    ],
  };
