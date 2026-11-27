import { excerptStepOutput } from '../summarizer/step-output';
import type { ChildClosing } from './closing';
import { AUTO_DEFAULT_EXPECTED } from './kickoff';
import { NO_CLOSING_REASON, type ProcessExit } from './result';
import { AUTO_ROLE_ARTIFACT, type AutoDelegationRole } from './roles';

const REMINDER =
  'Your last turn ended without the closing block, so Goodboy cannot tell whether the work is done. This is the only reminder. Do not start new work. If something you started is still running, wait for it or say it did not finish.';

const LOST_SESSION =
  'Your session was not kept, so here is what you were given and where you stopped.';

type DueParams = {
  readonly exit: ProcessExit;
  readonly reason: string | null;
};

export const isCloseNudgeDue = ({ exit, reason }: DueParams): boolean =>
  exit === 'ok' && reason === NO_CLOSING_REASON;

type ReplyParams = {
  readonly childAgentId: string;
};

const replyOf = ({ childAgentId }: ReplyParams): string =>
  `Reply with your \`<<outcome>>\` line, only what your report still misses, and \`<<step-done id="${childAgentId}">>\` on its own line. If you cannot finish, end with \`<<step-done id="${childAgentId}" status="returned" needs="shell">>\` instead and one line after it: what you need. \`needs\` is \`shell\`, \`writer\`, \`role:<role>\`, \`decision\` or \`user\`.`;

type RoleParams = {
  readonly role: AutoDelegationRole;
};

const owedOutputOf = ({ role }: RoleParams): ReadonlyArray<string> =>
  AUTO_ROLE_ARTIFACT[role] === null && role !== 'scribe'
    ? []
    : [`**Expected output** Goodboy reads it from this reply only. ${AUTO_DEFAULT_EXPECTED[role]}`];

export type CloseNudgeAnswered = Readonly<{
  question: string;
  answer: string;
  report: string | null;
}>;

export type CloseNudgeKickoffParams = Readonly<{
  role: AutoDelegationRole;
  childAgentId: string;
  memory?: Readonly<{
    brief: string;
    tail: string | null;
    answered?: CloseNudgeAnswered | null;
  }> | null;
}>;

type AnsweredParams = {
  readonly answered: CloseNudgeAnswered | null;
};

const answeredSectionsOf = ({ answered }: AnsweredParams): ReadonlyArray<string> => {
  if (answered === null) {
    return [];
  }
  return [
    `**Your question** ${answered.question}`,
    `**Answer** ${answered.answer}`,
    ...(answered.report === null || answered.report === ''
      ? []
      : [`**Report handed over**\n${answered.report}`]),
  ];
};

export const composeCloseNudgeKickoff = ({
  role,
  childAgentId,
  memory = null,
}: CloseNudgeKickoffParams): string => {
  const sections = [REMINDER];
  if (memory !== null && memory.brief !== '') {
    sections.push(LOST_SESSION, memory.brief);
    sections.push(...answeredSectionsOf({ answered: memory.answered ?? null }));
    if (memory.tail !== null && memory.tail !== '') {
      sections.push(`**Where you stopped** ${memory.tail}`);
    }
  }
  sections.push(...owedOutputOf({ role }), replyOf({ childAgentId }));
  return sections.join('\n\n');
};

type MissedClosingParams = {
  readonly summary: string;
};

export const missedClosingOf = ({ summary }: MissedClosingParams): ChildClosing => ({
  completion: 'none',
  question: null,
  returned: null,
  isLegacyBlock: false,
  summary,
});

type AfterNudgeParams = {
  readonly closing: ChildClosing;
  readonly earlier: string;
};

export const closingAfterNudge = ({ closing, earlier }: AfterNudgeParams): ChildClosing => ({
  ...closing,
  summary: excerptStepOutput({
    output: [earlier, closing.summary].filter((part) => part !== '').join('\n\n'),
  }),
});
