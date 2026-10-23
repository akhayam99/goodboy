import { GitPullRequest, Network, Plug, SquareTerminal, type LucideIcon } from 'lucide-react';

type PhoneGroup = {
  readonly title: string;
  readonly line: string;
  readonly icon: LucideIcon;
};

export const PHONE_GROUPS = [
  {
    title: 'Set up',
    line: 'Sign in to your agents and point Goodboy at a repository',
    icon: Plug,
  },
  {
    title: 'Work with an agent',
    line: 'It edits, explains and stops to ask when a choice is yours',
    icon: SquareTerminal,
  },
  {
    title: 'Orchestrate',
    line: 'Chain agents in a workflow, or let Auto plan and delegate',
    icon: Network,
  },
  {
    title: 'Review and ship',
    line: 'Read every change, then turn review comments into fixes',
    icon: GitPullRequest,
  },
] as const satisfies ReadonlyArray<PhoneGroup>;
