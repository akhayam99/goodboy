import { estimateTokens } from '../../../shared/utils/estimate-tokens';
import { redactSecrets } from '../../../shared/utils/redactSecrets';
import { ASK_LIVE_BUDGET_TOKENS } from './ASK_LIVE_BUDGET_TOKENS';

export type AskLiveCalls = Readonly<{
  agent: string;
  calls: ReadonlyArray<string>;
}>;

export type AskLiveCheck = Readonly<{
  project: string;
  name: string;
  outcome: string;
}>;

export type AskLiveScript = Readonly<{
  project: string | null;
  name: string;
  outcome: string;
  output: string;
}>;

export type AskLiveInput = Readonly<{
  calls: ReadonlyArray<AskLiveCalls>;
  checks: ReadonlyArray<AskLiveCheck>;
  worktrees: ReadonlyArray<string>;
  scripts: ReadonlyArray<AskLiveScript>;
}>;

type AskLiveSection = Readonly<{
  lines: ReadonlyArray<string>;
  isClipped: boolean;
}>;

type Params = {
  readonly live: AskLiveInput;
};

const OUTPUT_TAIL_CHARS = 1_200;

type TextParams = {
  readonly text: string;
};

const askLiveLineOf = ({ text }: TextParams): string => text.replace(/\s+/g, ' ').trim();

const outputTailOf = ({ text }: TextParams): string =>
  text
    .trim()
    .slice(-OUTPUT_TAIL_CHARS)
    .split('\n')
    .map((line) => `    ${line.trimEnd()}`)
    .join('\n');

const askLiveLinesOf = ({ live }: Params): ReadonlyArray<string> => [
  ...live.calls.flatMap((entry) =>
    entry.calls.length === 0
      ? []
      : [
          `- ${entry.agent}, last tool calls:`,
          ...entry.calls.map((call) => `  - ${askLiveLineOf({ text: call })}`),
        ],
  ),
  ...live.checks.map((check) => `- Check ${check.name} in ${check.project}: ${check.outcome}`),
  ...live.worktrees.map((line) => `- Worktree ${askLiveLineOf({ text: line })}`),
  ...live.scripts.flatMap((script) => {
    const where = script.project === null ? '' : ` in ${script.project}`;
    const head = `- Script ${script.name}${where}: ${script.outcome}`;
    return script.output.trim() === '' ? [head] : [head, outputTailOf({ text: script.output })];
  }),
];

export const askLiveSection = ({ live }: Params): AskLiveSection => {
  const kept: Array<string> = [];
  let used = 0;
  for (const line of askLiveLinesOf({ live })) {
    const clean = redactSecrets({ text: line });
    const cost = estimateTokens(`${clean}\n`);
    if (used + cost > ASK_LIVE_BUDGET_TOKENS) {
      return { lines: kept, isClipped: true };
    }
    kept.push(clean);
    used += cost;
  }
  return { lines: kept, isClipped: false };
};
