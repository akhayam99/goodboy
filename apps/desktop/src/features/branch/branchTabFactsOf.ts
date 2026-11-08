import type { FileDiff, PrCheckRun } from '@goodboy/types';
import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';
import { countNoun } from '../../shared/utils/countNoun';
import { countSlotText } from '../../shared/utils/countSlotText';
import { joinFacts } from '../../shared/utils/joinFacts';
import { checksCountsOf } from '../integrations/github/checksRollup';
import {
  worktreeEntryFactsOf,
  type EntryDiffStat,
  type WorktreeEntryFacts,
} from './worktreeEntryFacts';

export type BranchTabFact = {
  readonly text: string | null;
  readonly tone: 'danger' | 'warning' | 'info' | null;
  readonly tooltip: string | null;
  readonly diff: EntryDiffStat | null;
  readonly count: number | null;
};

export type BranchTabFacts = Readonly<Record<BranchTab, BranchTabFact>>;

export type BranchWorkCounts = {
  readonly runs: number;
  readonly runsNeedYou: number;
  readonly running: number;
  readonly questions: number;
  readonly waiting: number;
  readonly held: number;
  readonly artifacts: number;
  readonly artifactsNeedYou: number;
};

type Params = {
  readonly pullRequestState: PullRequestPresentationState;
  readonly commentsNeedYou: number;
  readonly commentsOpen: number;
  readonly files: number | null;
  readonly diff: EntryDiffStat | null;
  readonly commits: number | null;
  readonly notPushed: number | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly checksUnreadReason: string | null;
  readonly work?: BranchWorkCounts | null;
};

type EntryParams = {
  readonly entry: WorktreeEntryFacts[BranchTab];
  readonly count?: number | null;
};

const tabFactOf = ({ entry, count = null }: EntryParams): BranchTabFact => ({
  text: entry.text,
  tone: entry.tone,
  tooltip: entry.tooltip,
  diff: entry.diff,
  count,
});

type ChecksParams = EntryParams & Pick<Params, 'checks'>;

const checksFactOf = ({ checks, entry }: ChecksParams): BranchTabFact => {
  if (entry.text !== null || checks === null) {
    return tabFactOf({ entry });
  }
  const passed = checksCountsOf({ checks }).passed;
  return { ...tabFactOf({ entry }), text: countSlotText({ count: passed }) };
};

type CommentsParams = Pick<Params, 'commentsNeedYou' | 'commentsOpen'>;

const commentsFactOf = ({ commentsNeedYou, commentsOpen }: CommentsParams): BranchTabFact => {
  const open = countSlotText({ count: commentsOpen });
  if (commentsNeedYou > 0) {
    return {
      text: open ?? countSlotText({ count: commentsNeedYou }),
      tone: 'warning',
      tooltip: `${commentsNeedYou} need you`,
      diff: null,
      count: commentsOpen,
    };
  }
  return {
    text: open,
    tone: null,
    tooltip: open === null ? null : `${countNoun({ count: commentsOpen, one: 'comment' })} open`,
    diff: null,
    count: commentsOpen,
  };
};

const NO_FACT: BranchTabFact = { text: null, tone: null, tooltip: null, diff: null, count: null };

type WorkParams = {
  readonly work: BranchWorkCounts | null;
};

type TotalParams = {
  readonly work: BranchWorkCounts;
};

const workTotalOf = ({ work }: TotalParams): string =>
  [
    work.runs > 0 && countNoun({ count: work.runs, one: 'run' }),
    work.questions > 0 && countNoun({ count: work.questions, one: 'question' }),
    work.artifacts > 0 && countNoun({ count: work.artifacts, one: 'artifact' }),
  ]
    .filter((part) => typeof part === 'string')
    .join(', ');

const workFactOf = ({ work }: WorkParams): BranchTabFact => {
  if (work === null) {
    return NO_FACT;
  }
  const total = work.runs + work.questions + work.artifacts;
  const wantsYou = work.runsNeedYou + work.waiting + work.artifactsNeedYou;
  const tooltip = joinFacts({
    facts: [
      work.runsNeedYou > 0 &&
        `${countNoun({ count: work.runsNeedYou, one: 'run' })} ${work.runsNeedYou === 1 ? 'needs' : 'need'} you${work.held > 0 ? ` with ${countNoun({ count: work.held, one: 'question' })}` : ''}`,
      work.waiting > 0 &&
        `${countNoun({ count: work.waiting, one: 'question' })} ${work.waiting === 1 ? 'waits' : 'wait'} for you`,
      work.artifactsNeedYou > 0 &&
        `${countNoun({ count: work.artifactsNeedYou, one: 'artifact' })} ${work.artifactsNeedYou === 1 ? 'needs' : 'need'} you`,
      work.running > 0 && `${countNoun({ count: work.running, one: 'run' })} working`,
      workTotalOf({ work }),
    ],
  });
  const base = { tooltip: tooltip === '' ? null : tooltip, diff: null, count: total };
  if (wantsYou > 0) {
    return { ...base, text: countSlotText({ count: wantsYou }), tone: 'warning' };
  }
  if (work.running > 0) {
    return { ...base, text: countSlotText({ count: work.running }), tone: 'info' };
  }
  return { ...base, text: countSlotText({ count: total }), tone: null };
};

export const branchTabFactsOf = ({
  pullRequestState,
  commentsNeedYou,
  commentsOpen,
  files,
  diff,
  commits,
  notPushed,
  checks,
  checksUnreadReason,
  work = null,
}: Params): BranchTabFacts => {
  const entries = worktreeEntryFactsOf({
    pullRequestState,
    commentsNeedYou,
    files,
    diff,
    commits,
    notPushed,
    checks,
    checksUnreadReason,
  });
  return {
    pr: tabFactOf({ entry: entries.pr }),
    comments: commentsFactOf({ commentsNeedYou, commentsOpen }),
    files: tabFactOf({ entry: entries.files, count: files }),
    commits: tabFactOf({ entry: entries.commits, count: commits }),
    checks: checksFactOf({ checks, entry: entries.checks }),
    work: workFactOf({ work }),
  };
};

type ScopedFilesParams = {
  readonly files: ReadonlyArray<Pick<FileDiff, 'additions' | 'deletions'>>;
};

const scopedFilesFactOf = ({ files }: ScopedFilesParams): BranchTabFact => {
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  return branchTabFactsOf({
    pullRequestState: 'none',
    commentsNeedYou: 0,
    commentsOpen: 0,
    files: files.length,
    diff: { additions, deletions },
    commits: null,
    notPushed: null,
    checks: null,
    checksUnreadReason: null,
  }).files;
};

export const filesHeadFactOf = ({ files }: ScopedFilesParams): BranchTabFact =>
  scopedFilesFactOf({ files });
