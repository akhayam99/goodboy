import { countNoun } from '../../../../shared/utils/countNoun';
import type { BranchEntry } from '../branches/branchStoryOf';
import { agentsWordOf, checksWordsOf, stageWordOf, type ChecksWords } from './boardRowWordsOf';
import type { BoardRow } from './boardTypes';

type Params = {
  readonly row: BoardRow;
  readonly entry: BranchEntry | null;
  readonly settledAt: number | null;
  readonly now: number;
  readonly runningCount: number;
  readonly nextTitle: string | null;
};

export type BoardRowCells = Readonly<{
  title: string;
  stage: string;
  checks: ChecksWords;
  next: string;
  agents: string;
}>;

const AGENT_RUNNING_REASON = 'agent running';

type FactParams = {
  readonly text: string;
};

const factKeyOf = ({ text }: FactParams): string => text.trim().toLowerCase();

type SentenceParams = {
  readonly text: string;
};

const sentenceOf = ({ text }: SentenceParams): string =>
  text.length === 0 ? text : `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

type RunningParams = {
  readonly count: number;
};

const runningWordOf = ({ count }: RunningParams): string =>
  `${countNoun({ count, one: 'agent', many: 'agents' })} running`;

type AskParams = {
  readonly count: number;
};

const askWordOf = ({ count }: AskParams): string =>
  count === 0 ? '' : countNoun({ count, one: 'open question', many: 'open questions' });

export const boardRowCellsOf = ({
  row,
  entry,
  settledAt,
  now,
  runningCount,
  nextTitle,
}: Params): BoardRowCells => {
  const isBranchless = row.branch === null;
  const isAgentReason = row.stage.reason === AGENT_RUNNING_REASON && runningCount > 0;
  const askWord = askWordOf({ count: row.askIds.length });
  const stageWord =
    isBranchless && isAgentReason
      ? runningWordOf({ count: runningCount })
      : stageWordOf({ row, entry, settledAt, now });
  const branchlessTitle = nextTitle ?? (askWord !== '' ? askWord : sentenceOf({ text: stageWord }));
  const title = isBranchless ? branchlessTitle : (row.branch ?? '');
  const seen = new Set<string>(isBranchless ? [factKeyOf({ text: title })] : []);
  const keep = ({ text }: FactParams): string => {
    const key = factKeyOf({ text });
    if (key === '' || seen.has(key)) {
      return '';
    }
    seen.add(key);
    return text;
  };
  const stage = keep({ text: stageWord });
  const checksWords = row.isSettled ? { text: '', tone: null } : checksWordsOf({ entry });
  const checksText = keep({ text: checksWords.text });
  const checks: ChecksWords =
    checksText === '' ? { text: '', tone: null } : { text: checksText, tone: checksWords.tone };
  const next = keep({ text: nextTitle ?? askWord });
  const agents = isAgentReason && isBranchless ? '' : agentsWordOf({ runningCount });
  return { title, stage, checks, next, agents };
};
