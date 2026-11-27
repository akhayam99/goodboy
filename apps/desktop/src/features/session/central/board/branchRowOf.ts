import type { Tone } from '@goodboy/ui';
import { brandId, type OpenQuestionId } from '@goodboy/types';
import { countNoun } from '../../../../shared/utils/countNoun';
import { NAMES } from '../../../../shared/utils/names';
import { sentenceCase } from '../../../../shared/utils/sentenceCase';
import { STAGE_TONE } from '../../session-stage';
import type { ActionCardModel } from '../next/actionCardsOf';
import type { BranchEntry } from '../branches/branchStoryOf';
import type { BranchState } from '../branches/branchStateTone';
import { BRANCH_STATE_TONE } from '../branches/branchStateTone';
import type { BoardRow } from './boardTypes';
import { requestShortOf } from './requestShortOf';

export type BranchRowRung =
  | 'settled'
  | 'asked'
  | 'stopped'
  | 'permission'
  | 'blocked'
  | 'running'
  | 'waiting'
  | 'ready'
  | 'your-move'
  | 'unbranched';

export type BranchRowWord = Readonly<{
  word: string;
  tone: Tone;
}>;

export type BranchRowAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'card'; readonly index: number }
  | { readonly kind: 'question'; readonly questionId: OpenQuestionId }
  | { readonly kind: 'remove'; readonly mountId: string }
  | { readonly kind: 'open'; readonly label: string; readonly fact: BranchState | null };

export type BranchRowOverlap = Readonly<{
  fileCount: number;
  otherName: string;
}>;

export type BranchRow = Readonly<{
  rung: BranchRowRung;
  word: BranchRowWord | null;
  action: BranchRowAction;
  hoverFacts: ReadonlyArray<string>;
}>;

type Params = {
  readonly row: BoardRow;
  readonly entry: BranchEntry | null;
  readonly runningCount: number;
  readonly cards: ReadonlyArray<Pick<ActionCardModel, 'kind'>>;
  readonly shownAskIds: ReadonlySet<string>;
  readonly isPermissionShown: boolean;
  readonly isRebaseStopped: boolean;
  readonly failingCheckName: string | null;
  readonly overlap: BranchRowOverlap | null;
};

type RungOfState = 'blocked' | 'waiting' | 'ready' | 'your-move' | 'settled';

const RUNG_OF_STATE: Readonly<Record<BranchState, RungOfState>> = {
  unread: 'waiting',
  rebasing: 'waiting',
  gone: 'blocked',
  'nothing-committed': 'waiting',
  'not-pushed': 'your-move',
  'no-request': 'your-move',
  draft: 'your-move',
  open: 'waiting',
  'checks-running': 'waiting',
  'checks-failing': 'blocked',
  'in-review': 'waiting',
  'changes-requested': 'blocked',
  conflicts: 'blocked',
  approved: 'ready',
  ready: 'ready',
  queued: 'waiting',
  merged: 'settled',
  closed: 'settled',
};

const ANSWER_KINDS: ReadonlyArray<string> = ['question', 'answer-questions'];
const PERMISSION_KINDS: ReadonlyArray<string> = ['approve-tool', 'plan-ready'];
const REBASE_KINDS: ReadonlyArray<string> = ['rebase-project', 'rebase'];
const MERGE_KINDS: ReadonlyArray<string> = ['merge-pr'];

const CARD_KINDS_OF_STATE: Readonly<Partial<Record<BranchState, ReadonlyArray<string>>>> = {
  'checks-failing': ['fix-checks', 'rerun-check', 'run-failing-test'],
  conflicts: REBASE_KINDS,
  'changes-requested': ['resolve-threads'],
  'not-pushed': ['push-branch'],
  'no-request': ['open-pr'],
  draft: ['mark-ready'],
};

const OPEN_LABEL_OF_STATE: Readonly<Partial<Record<BranchState, string>>> = {
  'checks-failing': 'Open check',
  'changes-requested': 'Open comments',
};

const NONE: BranchRowAction = { kind: 'none' };

const SHOWN_PERMISSION: RungResult = { rung: 'permission', word: null, action: NONE };

type KindsParams = {
  readonly cards: ReadonlyArray<Pick<ActionCardModel, 'kind'>>;
  readonly kinds: ReadonlyArray<string>;
};

const cardActionOf = ({ cards, kinds }: KindsParams): BranchRowAction => {
  const index = cards.findIndex((card) => kinds.includes(card.kind));
  return index >= 0 ? { kind: 'card', index } : NONE;
};

type CardOrOpenParams = KindsParams & {
  readonly label: string;
  readonly fact: BranchState | null;
};

const cardOrOpenOf = ({ cards, kinds, label, fact }: CardOrOpenParams): BranchRowAction => {
  const action = cardActionOf({ cards, kinds });
  return action.kind === 'none' ? { kind: 'open', label, fact } : action;
};

type CauseParams = {
  readonly row: BoardRow;
  readonly isPermissionShown: boolean;
};

const permissionWordOf = ({ row, isPermissionShown }: CauseParams): BranchRowWord | null => {
  if (row.group !== 'needs-you') {
    return null;
  }
  if (row.stage.attention === 'plan-approval') {
    return { word: NAMES.needsApproval, tone: STAGE_TONE.attention };
  }
  if (row.stage.attention === 'needs-approval' && !isPermissionShown) {
    return { word: NAMES.waitingForPermission, tone: STAGE_TONE.attention };
  }
  return null;
};

type AskedParams = Pick<Params, 'row' | 'cards' | 'shownAskIds'>;

const askedActionOf = ({ row, cards, shownAskIds }: AskedParams): BranchRowAction => {
  const answer = cardActionOf({ cards, kinds: ANSWER_KINDS });
  if (answer.kind !== 'none') {
    return answer;
  }
  const askId = row.askIds.find((id) => !shownAskIds.has(id));
  return askId === undefined
    ? NONE
    : { kind: 'question', questionId: brandId<OpenQuestionId>({ value: askId }) };
};

type EntryParams = {
  readonly entry: BranchEntry;
};

const behindOf = ({ entry }: EntryParams): number =>
  entry.fact.behind === null ? 0 : entry.fact.behind;

const behindWordOf = ({ entry }: EntryParams): BranchRowWord => ({
  word: `${behindOf({ entry })} behind ${entry.fact.baseBranch}`,
  tone: 'neutral',
});

type StateParams = EntryParams & {
  readonly failingCheckName: string | null;
};

const storyWordOf = ({ entry, failingCheckName }: StateParams): BranchRowWord => {
  const { story, fact } = entry;
  if (story.state === 'checks-failing' && failingCheckName !== null) {
    return { word: `${failingCheckName} failed`, tone: story.tone };
  }
  if (story.state === 'open' && fact.request !== null) {
    return { word: `${requestShortOf({ request: fact.request })} open`, tone: story.tone };
  }
  return { word: story.word, tone: story.tone };
};

type RungParams = Params & {
  readonly entry: BranchEntry;
};

type RungResult = Readonly<{
  rung: BranchRowRung;
  word: BranchRowWord | null;
  action: BranchRowAction;
}>;

const entryRungOf = ({ entry, runningCount }: RungParams): RungOfState | 'running' => {
  const state = entry.story.state;
  const rung = RUNG_OF_STATE[state];
  if (rung === 'blocked') {
    return rung;
  }
  if (runningCount > 0) {
    return 'running';
  }
  if (state === 'open' && behindOf({ entry }) > 0) {
    return 'your-move';
  }
  return rung;
};

const blockedActionOf = ({ entry, cards }: RungParams): BranchRowAction => {
  const state = entry.story.state;
  const kinds = CARD_KINDS_OF_STATE[state];
  if (kinds === undefined) {
    return NONE;
  }
  const label = OPEN_LABEL_OF_STATE[state];
  return label === undefined
    ? cardActionOf({ cards, kinds })
    : cardOrOpenOf({ cards, kinds, label, fact: state });
};

const entryResultOf = ({ ...params }: RungParams): RungResult => {
  const { entry, cards, failingCheckName } = params;
  const rung = entryRungOf(params);
  const state = entry.story.state;
  const story = storyWordOf({ entry, failingCheckName });
  if (rung === 'running') {
    return { rung, word: { word: NAMES.running, tone: STAGE_TONE.running }, action: NONE };
  }
  if (rung === 'blocked') {
    return { rung, word: story, action: blockedActionOf(params) };
  }
  if (rung === 'ready') {
    return { rung, word: story, action: cardActionOf({ cards, kinds: MERGE_KINDS }) };
  }
  if (rung === 'your-move') {
    const kinds = CARD_KINDS_OF_STATE[state] ?? REBASE_KINDS;
    const word = RUNG_OF_STATE[state] === 'your-move' ? story : behindWordOf({ entry });
    return { rung, word, action: cardActionOf({ cards, kinds }) };
  }
  return { rung: 'waiting', word: story, action: NONE };
};

const branchRungOf = ({ ...params }: Params): RungResult => {
  const { row, entry, cards, shownAskIds, isPermissionShown } = params;
  const isShownPermission =
    isPermissionShown && row.group === 'needs-you' && row.stage.attention === 'needs-approval';
  if (row.isSettled) {
    const word = row.isClosed
      ? { word: 'Closed', tone: BRANCH_STATE_TONE.closed }
      : { word: 'Merged', tone: BRANCH_STATE_TONE.merged };
    const action: BranchRowAction =
      row.isMerged && row.mountId !== null ? { kind: 'remove', mountId: row.mountId } : NONE;
    return { rung: 'settled', word, action };
  }
  if (row.askIds.length > 0) {
    return {
      rung: 'asked',
      word: { word: NAMES.asksYou, tone: STAGE_TONE.attention },
      action: askedActionOf({ row, cards, shownAskIds }),
    };
  }
  if (params.isRebaseStopped) {
    return {
      rung: 'stopped',
      word: { word: NAMES.rebaseStopped, tone: 'warning' },
      action: { kind: 'open', label: NAMES.openRebase, fact: 'rebasing' },
    };
  }
  const permission = permissionWordOf({ row, isPermissionShown });
  if (permission !== null) {
    return {
      rung: 'permission',
      word: permission,
      action: cardOrOpenOf({ cards, kinds: PERMISSION_KINDS, label: NAMES.open, fact: null }),
    };
  }
  if (entry !== null) {
    const result = entryResultOf({ ...params, entry });
    return isShownPermission && result.rung !== 'blocked' ? SHOWN_PERMISSION : result;
  }
  if (isShownPermission) {
    return SHOWN_PERMISSION;
  }
  return {
    rung: 'unbranched',
    word: { word: sentenceCase({ text: row.stage.reason }), tone: 'neutral' },
    action: cards.length > 0 ? { kind: 'card', index: 0 } : NONE,
  };
};

type HoverParams = Params & {
  readonly rung: BranchRowRung;
};

const hoverFactsOf = ({ row, entry, runningCount, overlap, rung }: HoverParams) => {
  const facts: Array<string> = [];
  if (runningCount > 0 && rung !== 'running') {
    facts.push(countNoun({ count: runningCount, one: 'run' }));
  }
  if (entry !== null && behindOf({ entry }) > 0 && rung !== 'your-move' && !row.isSettled) {
    facts.push(`${behindOf({ entry })} behind ${entry.fact.baseBranch}`);
  }
  if (overlap !== null && !row.isSettled) {
    facts.push(
      `${countNoun({ count: overlap.fileCount, one: 'shared file' })}. Merge ${overlap.otherName} first.`,
    );
  }
  return facts;
};

export const branchRowOf = ({ ...params }: Params): BranchRow => {
  const { rung, word, action } = branchRungOf(params);
  return { rung, word, action, hoverFacts: hoverFactsOf({ ...params, rung }) };
};
