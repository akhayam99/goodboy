import type { AuxTaskId } from '@goodboy/types';

export const TASKS: ReadonlyArray<{
  readonly id: AuxTaskId;
  readonly label: string;
  readonly description: string;
}> = [
  {
    id: 'summarizer',
    label: 'Step summaries',
    description: 'Condenses each finished step into the summary the next step starts from',
  },
  {
    id: 'plan_generation',
    label: 'Plan drafting',
    description: 'Writes step plans in the workflow builder and the Workflow Studio',
  },
  {
    id: 'prose_polish',
    label: 'Prose polish',
    description: 'Polishes workflow goals and step instructions before they are used',
  },
  {
    id: 'agent_naming',
    label: 'Agent naming',
    description: 'Titles new agents, and the session itself, from your first message',
  },
  {
    id: 'issue_brief',
    label: 'Issue briefs',
    description: 'Turns a linked issue into a session title and goal you can accept or edit',
  },
  {
    id: 'workflow_orchestrator',
    label: 'Workflow orchestrator',
    description:
      'Reads each finished step of a dynamic workflow and picks the next one, or ends the run',
  },
  {
    id: 'question_delegate',
    label: 'Delegated answers',
    description: 'Answers an open question on your behalf when you hand it to an agent',
  },
  {
    id: 'pr_draft',
    label: 'PR and MR drafts',
    description: 'Preselected model for the agent that drafts a pull or merge request',
  },
  {
    id: 'rebase',
    label: 'Rebase',
    description:
      'Preselected model for the agent that rebases the session branch onto its base branch',
  },
];
