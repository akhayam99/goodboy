import type { PrCheckRun } from '@goodboy/types';
import type { PullRequestPresentationState } from '../../shared/utils/pullRequestPresentation';
import type { BranchTab } from '../../store/slices/navigation/types';
import { countSlotText } from '../../shared/utils/countSlotText';
import { joinFacts } from '../../shared/utils/joinFacts';
import { checksCountsOf, checksWordOf } from '../integrations/github/checksRollup';
import { pullRequestStateWordOf } from './pullRequestStateWordOf';

type WorktreeEntryTone = 'danger' | 'warning' | 'info' | null;

export type EntryDiffStat = {
  readonly additions: number;
  readonly deletions: number;
};

type WorktreeEntryFact = {
  readonly text: string | null;
  readonly tone: WorktreeEntryTone;
  readonly tooltip: string | null;
  readonly diff: EntryDiffStat | null;
  readonly notPushed: number | null;
};

export type WorktreeEntryFacts = Readonly<Record<BranchTab, WorktreeEntryFact>>;

type Params = {
  readonly pullRequestState: PullRequestPresentationState;
  readonly commentsNeedYou: number;
  readonly files: number | null;
  readonly diff: EntryDiffStat | null;
  readonly commits: number | null;
  readonly notPushed: number | null;
  readonly checks: ReadonlyArray<PrCheckRun> | null;
  readonly checksUnreadReason: string | null;
};

const EMPTY: WorktreeEntryFact = {
  text: null,
  tone: null,
  tooltip: null,
  diff: null,
  notPushed: null,
};

const SLOT_STATES: ReadonlySet<PullRequestPresentationState> =
  new Set<PullRequestPresentationState>(['draft', 'merged', 'closed']);

type PullRequestParams = Pick<Params, 'pullRequestState'>;

const pullRequestFactOf = ({ pullRequestState }: PullRequestParams): WorktreeEntryFact =>
  SLOT_STATES.has(pullRequestState)
    ? { ...EMPTY, text: pullRequestStateWordOf({ state: pullRequestState }) }
    : EMPTY;

type ChecksParams = Pick<Params, 'checks' | 'checksUnreadReason'>;

const checksFactOf = ({ checks, checksUnreadReason }: ChecksParams): WorktreeEntryFact => {
  if (checks === null) {
    return { ...EMPTY, tooltip: checksUnreadReason };
  }
  const counts = checksCountsOf({ checks });
  const word = checksWordOf({ runs: checks });
  if (counts.failing > 0) {
    return {
      ...EMPTY,
      text: countSlotText({ count: counts.failing }),
      tone: 'danger',
      tooltip: word,
    };
  }
  if (counts.running > 0) {
    return {
      ...EMPTY,
      text: countSlotText({ count: counts.running }),
      tone: 'info',
      tooltip: word,
    };
  }
  return { ...EMPTY, tooltip: word };
};

type CommitsParams = Pick<Params, 'commits' | 'notPushed'>;

const commitsFactOf = ({ commits, notPushed }: CommitsParams): WorktreeEntryFact => {
  const text = countSlotText({ count: commits });
  if (notPushed === null || notPushed <= 0) {
    return { ...EMPTY, text };
  }
  const tooltip = `${notPushed} not pushed`;
  return text === null
    ? { ...EMPTY, text: `↑${notPushed}`, tooltip }
    : { ...EMPTY, text, tooltip, notPushed };
};

type FilesParams = Pick<Params, 'files' | 'diff'>;

const filesFactOf = ({ files, diff }: FilesParams): WorktreeEntryFact => {
  const count = countSlotText({ count: files });
  const shownDiff = diff !== null && (diff.additions > 0 || diff.deletions > 0) ? diff : null;
  if (count === null && shownDiff === null) {
    return EMPTY;
  }
  if (shownDiff === null) {
    return { ...EMPTY, text: count };
  }
  const tooltip = joinFacts({
    facts: [
      count === null ? null : `${count} ${files === 1 ? 'file' : 'files'}`,
      `+${shownDiff.additions} -${shownDiff.deletions}`,
    ],
  });
  return { ...EMPTY, text: count, tooltip, diff: shownDiff };
};

export const worktreeEntryFactsOf = ({
  pullRequestState,
  commentsNeedYou,
  files,
  diff,
  commits,
  notPushed,
  checks,
  checksUnreadReason,
}: Params): WorktreeEntryFacts => {
  const needsYou = countSlotText({ count: commentsNeedYou });
  const needsYouWord = `${commentsNeedYou} need you`;
  return {
    pr: pullRequestFactOf({ pullRequestState }),
    comments:
      needsYou === null
        ? EMPTY
        : { ...EMPTY, text: needsYou, tone: 'warning', tooltip: needsYouWord },
    files: filesFactOf({ files, diff }),
    commits: commitsFactOf({ commits, notPushed }),
    checks: checksFactOf({ checks, checksUnreadReason }),
  };
};

type QuietParams = {
  readonly facts: WorktreeEntryFacts;
};

type TooltipParams = {
  readonly tooltip: string | null;
};

type CountedParams = {
  readonly text: string | null;
  readonly noun: string;
};

const quietOf = ({ tooltip }: TooltipParams): WorktreeEntryFact => ({
  ...EMPTY,
  tooltip: tooltip === null || tooltip === '' ? null : tooltip,
});

const countedOf = ({ text, noun }: CountedParams): string | null =>
  text === null ? null : `${text} ${noun}`;

export const wantsYouFactsOf = ({ facts }: QuietParams): WorktreeEntryFacts => ({
  pr: quietOf({ tooltip: facts.pr.text }),
  comments: facts.comments,
  files: quietOf({
    tooltip: facts.files.tooltip ?? countedOf({ text: facts.files.text, noun: 'files' }),
  }),
  commits: quietOf({
    tooltip: joinFacts({
      facts: [countedOf({ text: facts.commits.text, noun: 'commits' }), facts.commits.tooltip],
    }),
  }),
  checks:
    facts.checks.tone === 'danger' ? facts.checks : quietOf({ tooltip: facts.checks.tooltip }),
});
