import type { AuxTaskId } from '@goodboy/types';

export const TASKS: ReadonlyArray<{
  readonly id: AuxTaskId;
  readonly label: string;
  readonly description: string;
}> = [
  {
    id: 'summarizer',
    label: 'Step summaries',
    description: 'Sums up each finished step for the next one.',
  },
  {
    id: 'plan_generation',
    label: 'Plan drafting',
    description: 'Writes workflow steps from your goal.',
  },
  {
    id: 'prose_polish',
    label: 'Prose polish',
    description: 'Tidies goals and step instructions.',
  },
  {
    id: 'agent_naming',
    label: 'Agent naming',
    description: 'Names agents and the session from your first message.',
  },
  {
    id: 'issue_brief',
    label: 'Issue briefs',
    description: 'Turns a linked issue into a title and goal.',
  },
  {
    id: 'workflow_orchestrator',
    label: 'Workflow orchestrator',
    description: 'Picks the next step in an orchestrated run.',
  },
  {
    id: 'question_delegate',
    label: 'Delegated answers',
    description: 'Answers a question you hand to an agent.',
  },
  {
    id: 'pr_draft',
    label: 'PR and MR drafts',
    description: 'Model for the agent that drafts a pull or merge request.',
  },
  {
    id: 'rebase',
    label: 'Rebase',
    description: 'Model for the agent that rebases the branch.',
  },
];
