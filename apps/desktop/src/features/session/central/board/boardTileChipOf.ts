import type { Tone } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { sentenceCase } from '../../../../shared/utils/sentenceCase';
import { STAGE_TONE } from '../../session-stage';
import type { BranchEntry } from '../branches/branchStoryOf';
import { BRANCH_STATE_TONE, type BranchState } from '../branches/branchStateTone';
import { stageWordOf } from './boardRowWordsOf';
import type { BoardRow } from './boardTypes';
import { requestShortOf } from './requestShortOf';

type Params = {
  readonly row: BoardRow;
  readonly entry: BranchEntry | null;
  readonly runningCount: number;
};

type BoardTileChip = Readonly<{
  word: string;
  tone: Tone;
}>;

export const WAITS_FOR_YOU = 'Waits for you';

const BLOCKED_STATES: ReadonlySet<BranchState> = new Set<BranchState>([
  'checks-failing',
  'conflicts',
  'changes-requested',
  'gone',
]);

export const boardTileChipOf = ({ row, entry, runningCount }: Params): BoardTileChip => {
  if (row.isMerged) {
    return {
      word: stageWordOf({ row, entry, mergedAt: null, now: 0 }),
      tone: BRANCH_STATE_TONE.merged,
    };
  }
  if (row.askIds.length > 0) {
    return { word: WAITS_FOR_YOU, tone: STAGE_TONE.attention };
  }
  if (entry !== null && BLOCKED_STATES.has(entry.story.state)) {
    return { word: entry.story.word, tone: entry.story.tone };
  }
  if (row.group === 'needs-you') {
    return { word: WAITS_FOR_YOU, tone: STAGE_TONE.attention };
  }
  if (runningCount > 0) {
    return { word: NAMES.running, tone: STAGE_TONE.running };
  }
  if (entry === null) {
    return { word: sentenceCase({ text: row.stage.reason }), tone: 'neutral' };
  }
  const request = entry.fact.request;
  if (request !== null && entry.story.state === 'open') {
    return { word: `${requestShortOf({ request })} open`, tone: entry.story.tone };
  }
  return { word: entry.story.word, tone: entry.story.tone };
};
