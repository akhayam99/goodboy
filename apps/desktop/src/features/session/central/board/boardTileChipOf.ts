import type { Tone } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { sentenceCase } from '../../../../shared/utils/sentenceCase';
import { STAGE_TONE } from '../../session-stage';
import type { BranchEntry } from '../branches/branchStoryOf';
import type { BranchState } from '../branches/branchStateTone';
import type { BoardRow } from './boardTypes';
import { requestShortOf } from './requestShortOf';

type Params = {
  readonly row: BoardRow;
  readonly entry: BranchEntry | null;
  readonly runningCount: number;
  readonly isPermissionShown?: boolean;
};

type BoardTileChip = Readonly<{
  word: string;
  tone: Tone;
}>;

const BLOCKED_STATES: ReadonlySet<BranchState> = new Set<BranchState>([
  'checks-failing',
  'conflicts',
  'changes-requested',
  'gone',
]);

type ReasonParams = {
  readonly row: BoardRow;
  readonly isPermissionShown: boolean;
};

const needsYouReasonOf = ({ row, isPermissionShown }: ReasonParams): BoardTileChip | null => {
  if (row.stage.attention === 'plan-approval') {
    return { word: NAMES.needsApproval, tone: STAGE_TONE.attention };
  }
  if (row.stage.attention === 'needs-approval' && !isPermissionShown) {
    return { word: NAMES.waitingForPermission, tone: STAGE_TONE.attention };
  }
  return null;
};

export const boardTileChipOf = ({
  row,
  entry,
  runningCount,
  isPermissionShown = false,
}: Params): BoardTileChip | null => {
  if (row.isSettled) {
    return null;
  }
  if (row.askIds.length > 0) {
    return { word: NAMES.asksYou, tone: STAGE_TONE.attention };
  }
  if (entry !== null && BLOCKED_STATES.has(entry.story.state)) {
    return { word: entry.story.word, tone: entry.story.tone };
  }
  if (row.group === 'needs-you') {
    return needsYouReasonOf({ row, isPermissionShown });
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
