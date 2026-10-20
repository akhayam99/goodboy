import { ROLE_REGISTRY } from '../roles';
import { isAutoWriterRole, type AutoDelegationRole } from './roles';

export const AUTO_DEFAULT_DONE_WHEN = {
  scout:
    'The question is answered with file references, or the search is exhausted and the gaps are listed.',
  planner: 'A plan with steps, risks and acceptance checks exists and covers the request.',
  implementer:
    'The change is made in the mount, it builds, and the listed checks pass or their failure is explained. Nothing is pushed.',
  investigator:
    'A root cause is stated with evidence, and a fix is proposed. The fix itself is a later hand-over.',
  tester: 'The named behavior has tests that pass, or a failing case is shown with its output.',
  reviewer:
    'A verdict (approve or changes needed) with findings ordered by severity, on the named snapshot.',
  docs: 'The documentation change is made and nothing else changed.',
  scribe:
    'The pull request title and description are written from the diff of the branch. Goodboy opens or updates the pull request from them.',
  'ci-fixer':
    'The failing check passes locally, or its failure is explained, and the fix is committed. Nothing is pushed.',
  rewriter:
    'The commits of the branch are rewritten as asked, the final tree is unchanged unless the task says otherwise, and nothing is pushed.',
} as const satisfies Readonly<Record<AutoDelegationRole, string>>;

const artifactBlock = (kind: 'plan' | 'report'): string =>
  `A ${kind} artifact, written as one \`<<artifact v=1 kind=${kind}>>\` block that holds a JSON object with \`title\`, \`format\` ("markdown") and \`content\`, closed by \`<</artifact>>\`.`;

const LONG_REPORT_NOTE =
  ' If the report runs past a page, put it in a `<<artifact v=1 kind=report>>` block like a scout does and keep the summary short.';

export const AUTO_DEFAULT_EXPECTED = {
  scout: artifactBlock('report'),
  planner: artifactBlock('plan'),
  implementer: `A short text summary and the results of the checks you ran.${LONG_REPORT_NOTE}`,
  investigator: artifactBlock('report'),
  tester: `A short text summary and the results of the tests you ran.${LONG_REPORT_NOTE}`,
  reviewer: artifactBlock('report'),
  docs: `A short text summary and the results of the checks you ran.${LONG_REPORT_NOTE}`,
  scribe:
    'The pull request text in one `<<pr-title>>...<</pr-title>>` block and one `<<pr-body>>...<</pr-body>>` block. Do not run gh or git push: Goodboy opens the pull request.',
  'ci-fixer': `A short text summary, the commit you made and the checks you ran.${LONG_REPORT_NOTE}`,
  rewriter: 'The new commit list (sha and subject) and the checks you ran.',
} as const satisfies Readonly<Record<AutoDelegationRole, string>>;

export const AUTO_DEPENDENCIES_RULE =
  "If dependencies are missing, install them with the project's package manager in this mount. Never link or copy node_modules or other files from another checkout.";

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
  facts?: string | null;
  decisions?: string | null;
  retryNote?: string | null;
  isSubstep?: boolean;
}>;

type RoleSectionParams = {
  readonly role: AutoDelegationRole;
};

const roleSection = ({ role }: RoleSectionParams): string => {
  const access = isAutoWriterRole({ role })
    ? `You change files, only in the mount named below. ${AUTO_DEPENDENCIES_RULE}`
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
  readonly isSubstep: boolean;
};

const NEEDS_RULE =
  'When you cannot finish without a scout or an investigator, add `needs="scout"` or `needs="investigator"` to that question block: Auto may start one and answers you with its report.';

const returnContract = ({ childAgentId, isSubstep }: ReturnContractParams): string =>
  [
    `**Return** When the work is done, end your last message with \`<<step-done id="${childAgentId}">>\` on its own line. If you cannot go on and nothing can be asked, say why and end with \`<<step-done id="${childAgentId}" status="blocked">>\`.`,
    'When only the user or Auto can decide something, ask it in one `<<ctx-question blocking="true">>the question<</ctx-question>>` block and stop.',
    ...(isSubstep ? [] : [NEEDS_RULE]),
    'Do not hand the work to another agent, do not split it into several agents, and do not start subagents. If the result needs more work, say so and Auto decides.',
  ].join('\n');

export type AnswerKickoffParams = Readonly<{
  childAgentId: string;
  question: string;
  answer: string;
  memory?: Readonly<{ brief: string; tail: string | null }> | null;
  report?: string | null;
}>;

export const composeAnswerKickoff = ({
  childAgentId,
  question,
  answer,
  memory = null,
  report = null,
}: AnswerKickoffParams): string => {
  const sections = ['Auto answered the question you asked.'];
  if (memory !== null && memory.brief !== '') {
    sections.push(
      'Your session was not kept, so here is what you were given and where you stopped.',
      memory.brief,
    );
    if (memory.tail !== null && memory.tail !== '') {
      sections.push(`**Where you stopped** ${memory.tail}`);
    }
  }
  sections.push(
    `**Your question** ${question}`,
    `**Answer** ${answer}`,
    ...(report === null || report === '' ? [] : [`**Report handed over**\n${report}`]),
    `Continue the work. When it is done, end your last message with \`<<step-done id="${childAgentId}">>\` on its own line, as before.`,
  );
  return sections.join('\n\n');
};

export const composeDelegationKickoff = ({
  role,
  childAgentId,
  task,
  doneWhen,
  expected,
  inputs,
  revise,
  mountLabel,
  facts = null,
  decisions = null,
  retryNote = null,
  isSubstep = false,
}: DelegationKickoffParams): string => {
  const sections: string[] = [AUTO_KICKOFF_HEADER, roleSection({ role })];
  if (retryNote !== null) {
    sections.push(`**Retry** ${retryNote}`);
  }
  if (mountLabel !== null) {
    sections.push(`**Mount** ${mountLabel}`);
  }
  if (facts !== null) {
    sections.push(facts);
  }
  if (decisions !== null) {
    sections.push(decisions);
  }
  sections.push(revise === null ? `**Task** ${task}` : reviseSection({ revise }));
  sections.push(`**Done when** ${doneWhen ?? AUTO_DEFAULT_DONE_WHEN[role]}`);
  sections.push(`**Expected output** ${expected ?? AUTO_DEFAULT_EXPECTED[role]}`);
  if (inputs.length > 0) {
    sections.push(inputsSection({ inputs }));
  }
  sections.push(returnContract({ childAgentId, isSubstep }));
  return sections.join('\n\n');
};
