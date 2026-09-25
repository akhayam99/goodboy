import type { HandoffSection, HandoffSectionKind, HandoffSender } from '@goodboy/types';
import { pluralize } from '../../../shared/utils/pluralize';

export type HandoffNames = Readonly<{
  agentName: string | null;
  questionText: string | null;
}>;

type SenderLabelParams = {
  readonly sender: HandoffSender;
  readonly names: HandoffNames;
};

type DetailParams = {
  readonly head: string;
  readonly detail: string | null;
};

const withDetail = ({ head, detail }: DetailParams): string =>
  detail === null || detail.trim() === '' ? head : `${head} · ${detail}`;

export const handoffSenderLabel = ({ sender, names }: SenderLabelParams): string => {
  switch (sender.kind) {
    case 'you':
      return 'You';
    case 'orchestrator':
      return `Orchestrator · step ${sender.stepOrdinal}`;
    case 'workflowStep':
      return `Workflow step ${sender.stepOrdinal} of ${sender.stepCount}`;
    case 'resolve': {
      const count = pluralize(sender.threadIds.length, 'comment');
      return sender.prNumber === null
        ? `Resolve · ${count}`
        : `Resolve · ${count} on #${sender.prNumber}`;
    }
    case 'parent':
      return withDetail({
        head: `From ${names.agentName ?? 'another agent'}`,
        detail: sender.label,
      });
    case 'question':
      return withDetail({ head: 'Answering for you', detail: names.questionText });
    case 'followUp':
      return `Follow-up of ${names.agentName ?? 'another agent'}`;
    default: {
      const exhaustive: never = sender;
      return exhaustive;
    }
  }
};

export const HANDOFF_SECTION_LABEL: Readonly<Record<HandoffSectionKind, string>> = {
  ask: 'Ask',
  goal: 'Goal',
  earlierSteps: 'Earlier steps',
  plan: 'Plan',
  files: 'Files',
  threads: 'Threads',
  scope: 'Scope and rules',
  profile: 'About you',
  role: 'Role instructions',
};

type ChipLabelParams = {
  readonly section: HandoffSection;
};

export const handoffChipLabel = ({ section }: ChipLabelParams): string => {
  switch (section.kind) {
    case 'earlierSteps':
      return `${section.refs.length} earlier ${section.refs.length === 1 ? 'step' : 'steps'}`;
    case 'files':
      return pluralize(section.refs.length, 'file');
    case 'threads':
      return pluralize(section.refs.length, 'comment');
    case 'role':
      return `${section.summary.split(' · ')[0] ?? 'Role'} instructions`;
    case 'ask':
    case 'goal':
    case 'plan':
    case 'scope':
    case 'profile':
      return HANDOFF_SECTION_LABEL[section.kind];
    default: {
      const exhaustive: never = section.kind;
      return exhaustive;
    }
  }
};
