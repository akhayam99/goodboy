import type {
  AgentHandoff,
  AgentId,
  HandoffRef,
  HandoffSection,
  HandoffSender,
  IsoDateTime,
  PlanId,
  ProviderName,
} from '@goodboy/types';

export type HandoffEarlierStep = Readonly<{
  agentId: AgentId;
  ordinal: number;
  name: string;
  summary: string | null;
}>;

export type HandoffFile = Readonly<{
  label: string;
  path: string | null;
}>;

export type HandoffThread = Readonly<{
  threadId: string | null;
  author: string | null;
  location: string | null;
  link: string | null;
  body: string;
}>;

export type HandoffRule = Readonly<{
  label: string;
  text: string;
}>;

export type HandoffRole = Readonly<{
  label: string;
  instructions: string;
  isEdited: boolean;
}>;

export type BuildHandoffParams = Readonly<{
  agentId: AgentId;
  provider: ProviderName;
  createdAt: IsoDateTime;
  sender: HandoffSender;
  instruction: string;
  why: string | null;
  doneWhen: string | null;
  goal: string | null;
  earlierSteps: ReadonlyArray<HandoffEarlierStep>;
  plan: Readonly<{ id: PlanId; title: string }> | null;
  files: ReadonlyArray<HandoffFile>;
  threads: ReadonlyArray<HandoffThread>;
  scopeSummary: string;
  rules: ReadonlyArray<HandoffRule>;
  profile: string;
  role: HandoffRole | null;
  sent: Readonly<{ system: string | null; message: string }>;
}>;

const MAX_LINE = 160;

type TextParams = {
  readonly text: string;
};

const stripMarkdown = ({ text }: TextParams): string =>
  text
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(#{1,6}|[-*>]|\d+\.)\s+/, '')
    .trim();

export const handoffLine = ({ text }: TextParams): string => {
  const line = text
    .split('\n')
    .map((candidate) => stripMarkdown({ text: candidate }))
    .find((candidate) => candidate.length > 0);
  if (line === undefined) {
    return '';
  }
  const sentenceEnd = line.search(/[.!?](\s|$)/);
  const sentence = sentenceEnd === -1 ? line : line.slice(0, sentenceEnd + 1);
  return sentence.length > MAX_LINE ? `${sentence.slice(0, MAX_LINE - 1)}…` : sentence;
};

type CountParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const counted = ({ count, one, many }: CountParams): string =>
  `${count} ${count === 1 ? one : many}`;

type SectionParams = {
  readonly params: BuildHandoffParams;
};

const askSection = ({ params }: SectionParams): HandoffSection | null => {
  const instruction = params.instruction.trim();
  if (instruction === '') {
    return null;
  }
  const doneWhen = params.doneWhen?.trim() ?? '';
  const summary = handoffLine({ text: instruction });
  return {
    kind: 'ask',
    summary: doneWhen === '' ? summary : `${summary} Done when: ${handoffLine({ text: doneWhen })}`,
    bodyMd: instruction,
    refs: [],
  };
};

const goalSection = ({ params }: SectionParams): HandoffSection | null => {
  const goal = params.goal?.trim() ?? '';
  if (goal === '') {
    return null;
  }
  return { kind: 'goal', summary: handoffLine({ text: goal }), bodyMd: goal, refs: [] };
};

const earlierStepsSection = ({ params }: SectionParams): HandoffSection | null => {
  if (params.earlierSteps.length === 0) {
    return null;
  }
  const refs: ReadonlyArray<HandoffRef> = [...params.earlierSteps]
    .sort((a, b) => b.ordinal - a.ordinal)
    .map((step) => ({
      kind: 'agent',
      agentId: step.agentId,
      ordinal: step.ordinal,
      label: step.name,
      detail:
        step.summary === null || step.summary.trim() === ''
          ? null
          : handoffLine({ text: step.summary }),
    }));
  const noun = counted({ count: refs.length, one: 'step', many: 'steps' });
  return {
    kind: 'earlierSteps',
    summary: `${noun} passed ${refs.length === 1 ? 'its result' : 'their results'} to this one`,
    bodyMd: '',
    refs,
  };
};

const planSection = ({ params }: SectionParams): HandoffSection | null => {
  if (params.plan === null) {
    return null;
  }
  return {
    kind: 'plan',
    summary: params.plan.title,
    bodyMd: '',
    refs: [{ kind: 'plan', planId: params.plan.id, label: params.plan.title }],
  };
};

const filesSection = ({ params }: SectionParams): HandoffSection | null => {
  if (params.files.length === 0) {
    return null;
  }
  return {
    kind: 'files',
    summary: params.files.map((file) => file.label).join(' · '),
    bodyMd: '',
    refs: params.files.map((file) => ({ kind: 'file', label: file.label, path: file.path })),
  };
};

const threadsSection = ({ params }: SectionParams): HandoffSection | null => {
  if (params.threads.length === 0) {
    return null;
  }
  return {
    kind: 'threads',
    summary: counted({ count: params.threads.length, one: 'comment', many: 'comments' }),
    bodyMd: '',
    refs: params.threads.map((thread) => ({
      kind: 'thread',
      threadId: thread.threadId,
      label: handoffLine({ text: thread.body }),
      author: thread.author,
      location: thread.location,
      link: thread.link,
    })),
  };
};

const scopeSection = ({ params }: SectionParams): HandoffSection | null => {
  const rules = params.rules.filter((rule) => rule.text.trim() !== '');
  if (rules.length === 0) {
    return null;
  }
  return {
    kind: 'scope',
    summary: params.scopeSummary,
    bodyMd: rules.map((rule) => rule.text.trim()).join('\n\n'),
    refs: rules.map((rule) => ({
      kind: 'rule',
      label: rule.label,
      detail: handoffLine({ text: rule.text }),
    })),
  };
};

const profileSection = ({ params }: SectionParams): HandoffSection | null => {
  const profile = params.profile.trim();
  if (profile === '') {
    return null;
  }
  return {
    kind: 'profile',
    summary: 'What you told agents about yourself',
    bodyMd: profile,
    refs: [],
  };
};

const roleSection = ({ params }: SectionParams): HandoffSection | null => {
  const role = params.role;
  if (role === null || role.instructions.trim() === '') {
    return null;
  }
  return {
    kind: 'role',
    summary: `${role.label} · ${role.isEdited ? 'edited' : 'built in'}`,
    bodyMd: role.instructions.trim(),
    refs: [],
  };
};

const SECTION_BUILDERS = [
  askSection,
  goalSection,
  earlierStepsSection,
  planSection,
  filesSection,
  threadsSection,
  scopeSection,
  profileSection,
  roleSection,
] as const;

export const buildHandoff = (params: BuildHandoffParams): AgentHandoff => {
  const sections = SECTION_BUILDERS.flatMap((build) => {
    const section = build({ params });
    return section === null ? [] : [section];
  });
  const why = params.why?.trim() ?? '';
  const doneWhen = params.doneWhen?.trim() ?? '';
  return {
    agentId: params.agentId,
    sender: params.sender,
    ask: handoffLine({ text: params.instruction }),
    why: why === '' ? null : why,
    doneWhen: doneWhen === '' ? null : doneWhen,
    sections,
    sentSystem: params.sent.system,
    sentMessage: params.sent.message,
    provider: params.provider,
    createdAt: params.createdAt,
  };
};
