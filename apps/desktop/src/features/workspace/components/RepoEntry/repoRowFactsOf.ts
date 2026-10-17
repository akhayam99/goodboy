import type { BaseDivergence } from '@goodboy/types';
import type { RepoPull } from '../../../../store/slices/repo-divergence/state';
import { dirtyTreeSentence } from '../../../../shared/lib/dirtyTreeCopy';

export type RepoRowTone = 'info' | 'warning' | 'danger' | 'muted' | 'faint';

export type RepoRowGlyph = 'behind' | 'diverged' | 'ahead' | 'up-to-date' | 'failed' | 'none';

export type RepoRowFacts = {
  readonly word: string;
  readonly tone: RepoRowTone;
  readonly glyph: RepoRowGlyph;
  readonly tooltip: string;
  readonly isPullable: boolean;
  readonly isPulling: boolean;
  readonly note: string | null;
};

type Params = {
  readonly report: BaseDivergence | undefined;
  readonly pull: RepoPull | undefined;
};

type PluralParams = {
  readonly count: number;
  readonly noun: string;
};

const plural = ({ count, noun }: PluralParams): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

type QuietParams = {
  readonly word: string;
  readonly tooltip: string;
  readonly tone: RepoRowTone;
};

const quiet = ({ word, tooltip, tone }: QuietParams): RepoRowFacts => ({
  word,
  tone,
  glyph: tone === 'danger' ? 'failed' : 'none',
  tooltip,
  isPullable: false,
  isPulling: false,
  note: null,
});

type BehindParams = {
  readonly report: BaseDivergence;
  readonly base: string;
  readonly upstream: string;
};

const behindFacts = ({ report, base, upstream }: BehindParams): RepoRowFacts => {
  const tooltip = `New on ${upstream}: ${plural({ count: report.behind, noun: 'commit' })}. Pull fast-forwards ${base}.`;
  const isOnBase = report.checkoutBranch === base;
  if (isOnBase && report.uncommitted > 0) {
    return {
      word: `${report.behind} behind`,
      tone: 'info',
      glyph: 'behind',
      tooltip,
      isPullable: false,
      isPulling: false,
      note: dirtyTreeSentence({ count: report.uncommitted }),
    };
  }
  const isElsewhere = report.checkoutBranch !== null && !isOnBase;
  return {
    word: `${report.behind} behind`,
    tone: 'info',
    glyph: 'behind',
    tooltip,
    isPullable: true,
    isPulling: false,
    note: isElsewhere
      ? `Pull updates ${base} without switching: your checkout stays on ${report.checkoutBranch}.`
      : null,
  };
};

type ReportParams = {
  readonly report: BaseDivergence;
};

const reportFacts = ({ report }: ReportParams): RepoRowFacts => {
  const base = report.base ?? 'the base branch';
  const upstream = report.upstream ?? `origin/${base}`;
  switch (report.state) {
    case 'up-to-date':
      return {
        ...quiet({ word: 'Up to date', tooltip: `Same commit as ${upstream}.`, tone: 'faint' }),
        glyph: 'up-to-date',
      };
    case 'behind':
      return behindFacts({ report, base, upstream });
    case 'ahead':
      return {
        ...quiet({
          word: `${report.ahead} ahead`,
          tooltip: `Local ${base} has ${plural({ count: report.ahead, noun: 'commit' })} that ${upstream} does not. Nothing to pull.`,
          tone: 'muted',
        }),
        glyph: 'ahead',
      };
    case 'diverged':
      return {
        ...quiet({
          word: `Diverged ↑${report.ahead} ↓${report.behind}`,
          tooltip: `Local ${base} has ${plural({ count: report.ahead, noun: 'commit' })} of its own and ${upstream} has ${plural({ count: report.behind, noun: 'new commit' })}. Goodboy only fast-forwards, so it leaves ${base} as it is: merge or rebase it yourself.`,
          tone: 'warning',
        }),
        glyph: 'diverged',
      };
    case 'no-upstream':
      return quiet({
        word: 'No upstream',
        tooltip: `Local ${base} tracks no branch on a remote.`,
        tone: 'muted',
      });
    case 'no-base':
      return quiet({
        word: 'No base branch',
        tooltip:
          report.base === null
            ? 'No base branch is set and origin names no default branch.'
            : `There is no local branch ${report.base}.`,
        tone: 'muted',
      });
    case 'fetch-failed':
      return {
        ...quiet({
          word: "Couldn't reach origin",
          tooltip: report.message ?? 'The fetch failed.',
          tone: 'muted',
        }),
        glyph: 'failed',
      };
    case 'missing':
      return quiet({
        word: 'Folder missing',
        tooltip: 'Goodboy cannot reach this folder.',
        tone: 'danger',
      });
    default: {
      const exhaustive: never = report.state;
      return exhaustive;
    }
  }
};

export const repoRowFactsOf = ({ report, pull }: Params): RepoRowFacts => {
  const facts =
    report === undefined
      ? quiet({
          word: 'Checking…',
          tooltip: 'Fetching origin to compare the base branch.',
          tone: 'faint',
        })
      : reportFacts({ report });
  if (pull?.kind === 'pulling') {
    return { ...facts, word: 'Pulling…', isPullable: false, isPulling: true };
  }
  if (pull?.kind === 'refused') {
    return { ...facts, note: pull.reason };
  }
  return facts;
};
