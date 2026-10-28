type Params = {
  readonly output: string;
};

export type PushFailureDigest = {
  readonly check: string | null;
  readonly findings: ReadonlyArray<string>;
  readonly verdict: string | null;
};

const MAX_FINDINGS = 12;
const MAX_LINE = 160;

const COMMAND_LINE = /^(?:[$>]|❯)\s+(\S.*)$/;
const HOOK_LINE = /^husky\s+-\s+(\S+)\s+(?:script|hook)\s+failed/i;
const LEFTHOOK_LINE = /^(?:✖|x)\s+(\S.*)$/i;
const VERDICT_LINE = /^(?:error:\s+)?failed to push some refs|^!\s+\[(?:remote )?rejected\]/i;
const NOISE_LINE =
  /^(?:to\s+\S+|hint:|remote:\s*$|everything up-to-date|(?:error\s+)?command failed with exit code|yarn run v|info visit https:\/\/yarnpkg|npm err!|husky\s+-|\.\.\.$)/i;

type ClipParams = {
  readonly line: string;
};

const clipPushLine = ({ line }: ClipParams): string =>
  line.length > MAX_LINE ? `${line.slice(0, MAX_LINE)}...` : line;

export const pushFailureDigest = ({ output }: Params): PushFailureDigest => {
  const lines = output
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);
  let hook: string | null = null;
  let command: string | null = null;
  let verdict: string | null = null;
  const findings: Array<string> = [];
  for (const line of lines) {
    const text = line.trim();
    const hookName = HOOK_LINE.exec(text)?.[1];
    if (hookName !== undefined) {
      hook = hook ?? hookName;
      continue;
    }
    if (VERDICT_LINE.test(text)) {
      verdict = verdict ?? clipPushLine({ line: text });
      continue;
    }
    const commandText = COMMAND_LINE.exec(text)?.[1];
    if (commandText !== undefined && command === null) {
      command = commandText.trim();
      continue;
    }
    const lefthookName = LEFTHOOK_LINE.exec(text)?.[1];
    if (lefthookName !== undefined && command === null) {
      command = lefthookName.trim();
      continue;
    }
    if (NOISE_LINE.test(text) || findings.length >= MAX_FINDINGS) {
      continue;
    }
    findings.push(clipPushLine({ line }));
  }
  const parts = [hook, command].flatMap((part) => (part === null ? [] : [part]));
  return {
    check: parts.length === 0 ? null : parts.join(': '),
    findings,
    verdict,
  };
};
