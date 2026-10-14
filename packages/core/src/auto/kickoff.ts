import { ROLE_REGISTRY } from '../roles';
import { isAutoWriterRole, type AutoDelegationRole } from './roles';

export const AUTO_DEFAULT_DONE_WHEN = {
  scout:
    'The question is answered with file references, or the search is exhausted and the gaps are listed.',
  planner: 'A plan with steps, risks and acceptance checks exists and covers the request.',
  implementer:
    'The change is made in the mount, it builds, and the listed checks pass or their failure is explained.',
  investigator:
    'A root cause is stated with evidence, and a fix is proposed. The fix itself is a later hand-over.',
  tester: 'The named behavior has tests that pass, or a failing case is shown with its output.',
  reviewer:
    'A verdict (approve or changes needed) with findings ordered by severity, on the named snapshot.',
  docs: 'The documentation change is made and nothing else changed.',
} as const satisfies Readonly<Record<AutoDelegationRole, string>>;

const artifactBlock = (kind: 'plan' | 'report'): string =>
  `A ${kind} artifact, written as one \`<<artifact v=1 kind=${kind}>>\` block that holds a JSON object with \`title\`, \`format\` ("markdown") and \`content\`, closed by \`<</artifact>>\`.`;

export const AUTO_DEFAULT_EXPECTED = {
  scout: artifactBlock('report'),
  planner: artifactBlock('plan'),
  implementer: 'A short text summary and the results of the checks you ran.',
  investigator: artifactBlock('report'),
  tester: 'A short text summary and the results of the tests you ran.',
  reviewer: artifactBlock('report'),
  docs: 'A short text summary and the results of the checks you ran.',
} as const satisfies Readonly<Record<AutoDelegationRole, string>>;

export const AUTO_KICKOFF_HEADER =
  'You were started by Auto and report back to Auto. A question you ask goes to Auto first. Never emit `<<fan-out>>`, `<<scout-split>>` or `<<handoff>>` markers and never start other agents yourself: Auto does that.';

export type KickoffArtifactInput = Readonly<{
  artifactId: string;
  kind: string;
  title: string;
  revision: number;
  body: string;
}>;

export type KickoffHistoryEntry = Readonly<{
  revision: number;
  author: string;
  ask: string | null;
}>;

export type KickoffRevise = Readonly<{
  artifactId: string;
  kind: string;
  title: string;
  revision: number;
  body: string;
  userWords: ReadonlyArray<string>;
  autoReading: string | null;
  history: ReadonlyArray<KickoffHistoryEntry>;
}>;

export type DelegationKickoffParams = Readonly<{
  role: AutoDelegationRole;
  childAgentId: string;
  task: string;
  doneWhen: string | null;
  expected: string | null;
  inputs: ReadonlyArray<KickoffArtifactInput>;
  revise: KickoffRevise | null;
  mountLabel: string | null;
  retryNote?: string | null;
}>;

type RoleSectionParams = {
  readonly role: AutoDelegationRole;
};

const roleSection = ({ role }: RoleSectionParams): string => {
  const access = isAutoWriterRole({ role })
    ? 'You change files, only in the mount named below.'
    : 'You read only. You never change a file.';
  return [`**Role** ${role}. ${ROLE_REGISTRY[role].explain.does}`, access].join(' ');
};

type InputsParams = {
  readonly inputs: ReadonlyArray<KickoffArtifactInput>;
};

const inputsSection = ({ inputs }: InputsParams): string =>
  inputs
    .map(
      (input) =>
        `**Earlier ${input.kind}** ${input.title} (${input.artifactId}, version ${input.revision})\n${input.body}`,
    )
    .join('\n\n');

type ReviseSectionParams = {
  readonly revise: KickoffRevise;
};

const reviseSection = ({ revise }: ReviseSectionParams): string => {
  const next = revise.revision + 1;
  const parts: string[] = [
    `**Task** Revise the ${revise.kind} ${revise.title}, now at version ${revise.revision}, into version ${next}.`,
  ];
  if (revise.userWords.length > 0) {
    parts.push(['**The user wrote (verbatim)**', ...revise.userWords].join('\n'));
  }
  if (revise.autoReading !== null) {
    parts.push(`**Auto's reading** ${revise.autoReading}`);
  }
  parts.push(
    `**Rules** Write the full updated ${revise.kind} as one ${revise.kind} block, never a patch. Keep every part and sentence the change did not touch. Keep the structured metadata of the ${revise.kind}.`,
  );
  if (revise.history.length > 0) {
    parts.push(
      [
        '**Earlier changes, newest first** Do not undo them.',
        ...revise.history.map(
          (entry) =>
            `- version ${entry.revision} by ${entry.author}${entry.ask === null ? '' : `: ${entry.ask}`}`,
        ),
      ].join('\n'),
    );
  }
  parts.push(`**Current version ${revise.revision}**\n${revise.body}`);
  return parts.join('\n\n');
};

type ReturnContractParams = {
  readonly childAgentId: string;
};

const returnContract = ({ childAgentId }: ReturnContractParams): string =>
  [
    `**Return** When the work is done, end your last message with \`<<step-done id="${childAgentId}">>\` on its own line. If you cannot go on and nothing can be asked, say why and end with \`<<step-done id="${childAgentId}" status="blocked">>\`.`,
    'When only the user or Auto can decide something, ask it in one `<<ctx-question blocking="true">>the question<</ctx-question>>` block and stop.',
    'Do not hand the work to another agent, do not split it into several agents, and do not start subagents. If the result needs more work, say so and Auto decides.',
  ].join('\n');

export type AnswerKickoffParams = Readonly<{
  childAgentId: string;
  question: string;
  answer: string;
}>;

export const composeAnswerKickoff = ({
  childAgentId,
  question,
  answer,
}: AnswerKickoffParams): string =>
  [
    'Auto answered the question you asked.',
    `**Your question** ${question}`,
    `**Answer** ${answer}`,
    `Continue the work. When it is done, end your last message with \`<<step-done id="${childAgentId}">>\` on its own line, as before.`,
  ].join('\n\n');

export const composeDelegationKickoff = ({
  role,
  childAgentId,
  task,
  doneWhen,
  expected,
  inputs,
  revise,
  mountLabel,
  retryNote = null,
}: DelegationKickoffParams): string => {
  const sections: string[] = [AUTO_KICKOFF_HEADER, roleSection({ role })];
  if (retryNote !== null) {
    sections.push(`**Retry** ${retryNote}`);
  }
  if (mountLabel !== null) {
    sections.push(`**Mount** ${mountLabel}`);
  }
  sections.push(revise === null ? `**Task** ${task}` : reviseSection({ revise }));
  sections.push(`**Done when** ${doneWhen ?? AUTO_DEFAULT_DONE_WHEN[role]}`);
  sections.push(`**Expected output** ${expected ?? AUTO_DEFAULT_EXPECTED[role]}`);
  if (inputs.length > 0) {
    sections.push(inputsSection({ inputs }));
  }
  sections.push(returnContract({ childAgentId }));
  return sections.join('\n\n');
};
