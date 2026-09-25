import type { AgentRole, AuxTaskId } from '@goodboy/types';

export type DefaultsGroup<Id extends string> = {
  readonly id: string;
  readonly label: string;
  readonly members: ReadonlyArray<Id>;
};

export type DefaultGroups = {
  readonly agents: ReadonlyArray<DefaultsGroup<AgentRole>>;
  readonly tasks: ReadonlyArray<DefaultsGroup<AuxTaskId>>;
};

export const DEFAULT_GROUPS: DefaultGroups = {
  agents: [
    { id: 'explore', label: 'Explore and plan', members: ['scout', 'investigator', 'planner'] },
    { id: 'build', label: 'Build', members: ['implementer', 'tester', 'resolver'] },
    {
      id: 'review',
      label: 'Review and write',
      members: ['reviewer', 'docs', 'report', 'wireframe'],
    },
    { id: 'other', label: 'Other', members: ['custom'] },
  ],
  tasks: [
    {
      id: 'writing',
      label: 'Writing for you',
      members: ['plan_generation', 'prose_polish', 'agent_naming', 'issue_brief', 'pr_draft'],
    },
    {
      id: 'workflows',
      label: 'Running workflows',
      members: ['summarizer', 'workflow_orchestrator', 'question_delegate'],
    },
    { id: 'git', label: 'Git', members: ['rebase'] },
  ],
};
