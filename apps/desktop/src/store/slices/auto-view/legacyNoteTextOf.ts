import { isOpenQuestionAnswerText } from '@goodboy/core/context';

export const USER_ORIGIN_LEGACY_READ_UNTIL = '0.45.0';

type Params = {
  readonly text: string;
};

const RESTART_RESUME_LINE =
  'Goodboy restarted while you were working on the last message, so your previous turn was cut off. Check the current state of the files and of any command you had started before you run it again, then carry on from where you stopped.';

const SYSTEM_LINES: ReadonlyArray<RegExp> = [
  /^Permission for .+ is granted for this one call\.$/,
  /^Permission for .+ is now granted\.$/,
  /^Permission for that exact command is granted for this one call\. Continue where you stopped\.$/,
  /^Retry the tool call that was blocked, then continue where you stopped\.$/,
  /^Denied .+ for this one call\. Do not run it; carry on another way, or say what you need\.$/,
  /^Continue from where you stopped\.$/,
  /^Continue the agent that stopped from where it left off\.$/,
  /^Continue with .+\. Go on past the first check\.$/,
];

const SYSTEM_TEXTS: ReadonlyArray<RegExp> = [
  /^Continue the [^\n]+ that stopped \(delegation [^)\n]+\) from where it left off(?:\.|:[\s\S]*)$/,
  /^The .+ you started stopped at its usage limit, and its continuation didn't start: [\s\S]*$/,
];

const DENIED_WITH_REASON = /^Denied [A-Za-z][\w:-]*(?: and [A-Za-z][\w:-]*)*\. (.+)$/;

const isSystemText = ({ text }: Params): boolean =>
  text === RESTART_RESUME_LINE ||
  isOpenQuestionAnswerText(text) ||
  SYSTEM_TEXTS.some((pattern) => pattern.test(text));

export const legacyNoteTextOf = ({ text }: Params): string | null => {
  const whole = text.trim();
  if (isSystemText({ text: whole })) {
    return null;
  }
  const lines = whole.split('\n');
  const reasons: string[] = [];
  const firstWordsIndex = lines.findIndex((raw) => {
    const line = raw.trim();
    const reason = DENIED_WITH_REASON.exec(line)?.[1];
    if (reason !== undefined) {
      reasons.push(reason);
      return false;
    }
    return line !== '' && !SYSTEM_LINES.some((pattern) => pattern.test(line));
  });
  const rest = firstWordsIndex === -1 ? '' : lines.slice(firstWordsIndex).join('\n').trim();
  const words = isSystemText({ text: rest }) ? [] : [rest];
  const note = [...reasons, ...words].join('\n').trim();
  return note === '' ? null : note;
};
