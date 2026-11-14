import type { Tone } from '@goodboy/ui';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import type { BranchEntry } from '../branches/branchStoryOf';
import type { BoardRow } from './boardTypes';

export type ChecksWords = Readonly<{
  text: string;
  tone: Tone | null;
}>;

type StageParams = {
  readonly row: BoardRow;
  readonly entry: BranchEntry | null;
  readonly mergedAt: number | null;
  readonly now: number;
};

export const stageWordOf = ({ row, entry, mergedAt, now }: StageParams): string => {
  if (row.isMerged) {
    const age = mergedAt === null ? '' : formatAge({ from: new Date(mergedAt).toISOString(), now });
    return age === '' ? 'Merged' : `Merged ${age}`;
  }
  if (entry === null) {
    return row.stage.reason;
  }
  return entry.story.word;
};

type ChecksParams = {
  readonly entry: BranchEntry | null;
};

export const checksWordsOf = ({ entry }: ChecksParams): ChecksWords => {
  if (entry === null) {
    return { text: '', tone: null };
  }
  const request = entry.fact.request;
  if (request === null) {
    return entry.fact.status?.push.kind === 'not-pushed'
      ? { text: 'Not pushed', tone: null }
      : { text: '', tone: null };
  }
  switch (request.checks) {
    case 'success':
      return { text: 'Checks passing', tone: null };
    case 'failure':
      return { text: 'Checks failing', tone: 'danger' };
    case 'pending':
      return { text: 'Checks running', tone: null };
    case null:
      return { text: '', tone: null };
    default: {
      const exhaustive: never = request.checks;
      return exhaustive;
    }
  }
};

type AgentsParams = {
  readonly runningCount: number;
};

export const agentsWordOf = ({ runningCount }: AgentsParams): string =>
  runningCount === 0 ? '' : `${runningCount} running`;

type HoursParams = {
  readonly elapsedMs: number;
};

const HOUR_MS = 3_600_000;

const MINUTE_MS = 60_000;

export const elapsedWordOf = ({ elapsedMs }: HoursParams): string => {
  if (elapsedMs >= HOUR_MS) {
    return `${(elapsedMs / HOUR_MS).toFixed(1)}h`;
  }
  return `${Math.round(elapsedMs / MINUTE_MS)}m`;
};
