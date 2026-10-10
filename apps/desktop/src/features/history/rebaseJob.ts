import { isHistoryRunActive } from '../../store/slices/history/isHistoryRunActive';
import type { HistoryRun } from '../../store/slices/history/types';
import { historyStopCause } from './historyStopCause';

type RebaseJobState =
  | 'checking'
  | 'replaying'
  | 'merging'
  | 'checking-result'
  | 'waiting'
  | 'moving'
  | 'updating-online'
  | 'done'
  | 'dirty'
  | 'stuck'
  | 'no-provider'
  | 'result-differs'
  | 'origin-moved'
  | 'head-moved'
  | 'push-failed'
  | 'blocked'
  | 'failed';

export type RebaseJobTone = 'info' | 'ok' | 'warn' | 'danger';

export type RebaseJob = {
  readonly state: RebaseJobState;
  readonly tone: RebaseJobTone;
  readonly isRunning: boolean;
  readonly isSettled: boolean;
  readonly title: string;
  readonly line: string;
  readonly detail: string | null;
  readonly word: string;
};

type Params = {
  readonly run: HistoryRun;
  readonly projectName: string;
  readonly baseBranch: string;
  readonly commitCount: number | null;
  readonly dirtyCount: number | null;
};

type Copy = {
  readonly tone: RebaseJobTone;
  readonly title: string;
  readonly line: string;
  readonly detail?: string | null;
};

const LINE_LIMIT = 160;

type FirstLineOfParams = {
  readonly text: string;
};

const firstLineOf = ({ text }: FirstLineOfParams): string => {
  const line = text.split('\n')[0]?.trim() ?? '';
  return line.length > LINE_LIMIT ? `${line.slice(0, LINE_LIMIT)}...` : line;
};

type DetailOfParams = {
  readonly text: string;
};

const detailOf = ({ text }: DetailOfParams): string | null => {
  const trimmed = text.trim();
  return trimmed === '' || trimmed === firstLineOf({ text: trimmed }) ? null : trimmed;
};

type FilesLabelOfParams = {
  readonly files: ReadonlyArray<string>;
};

const filesLabelOf = ({ files }: FilesLabelOfParams): string => {
  const [first] = files;
  if (first === undefined) {
    return 'the conflict';
  }
  return files.length === 1 ? first : `${first} and ${files.length - 1} more`;
};

type DirtyTitleOfParams = {
  readonly count: number | null;
};

const dirtyTitleOf = ({ count }: DirtyTitleOfParams): string => {
  if (count === null) {
    return 'Some files have changes that are not committed';
  }
  return `${count} ${count === 1 ? 'file has' : 'files have'} changes that are not committed`;
};

type KeptFilesOfParams = {
  readonly count: number | null;
};

const keptFilesOf = ({ count }: KeptFilesOfParams): string => {
  if (count === null || count === 0) {
    return '';
  }
  return count === 1 ? ' Your file was not touched.' : ` Your ${count} files were not touched.`;
};

type CommitsOfParams = {
  readonly count: number | null;
};

const commitsOf = ({ count }: CommitsOfParams): string => {
  if (count === null) {
    return '';
  }
  return `${count} ${count === 1 ? 'commit' : 'commits'}.`;
};

type ReplayLineOfParams = {
  readonly run: HistoryRun;
};

const replayLineOf = ({ run }: ReplayLineOfParams): string => {
  if (run.progress?.stage === 'step' && run.progress.index > 0) {
    return `Replaying ${run.progress.index} of ${run.progress.total}`;
  }
  const count = run.progress?.stage === 'step' ? run.progress.total : run.commitCount;
  if (count === null) {
    return 'Replaying';
  }
  return `Replaying ${count} ${count === 1 ? 'commit' : 'commits'}`;
};

type RunningStateOfParams = {
  readonly run: HistoryRun;
};

const runningStateOf = ({ run }: RunningStateOfParams): RebaseJobState => {
  if (run.phase === 'waiting') {
    return 'waiting';
  }
  if (run.phase === 'applying') {
    return 'moving';
  }
  if (run.phase === 'pushing') {
    return 'updating-online';
  }
  if (run.progress?.stage === 'check' || run.progress?.stage === 'cleanup') {
    return 'checking-result';
  }
  if (run.phase === 'rewriting') {
    return 'merging';
  }
  const isReplaying =
    run.phase === 'trying' && (run.progress?.stage === 'step' || run.commitCount !== null);
  return isReplaying ? 'replaying' : 'checking';
};

type StoppedStateOfParams = {
  readonly run: HistoryRun;
};

const stoppedStateOf = ({ run }: StoppedStateOfParams): RebaseJobState => {
  const reason = run.stop?.reason;
  switch (reason) {
    case 'dirty':
      return 'dirty';
    case 'stuck':
      return 'stuck';
    case 'no-provider':
      return 'no-provider';
    case 'unverified':
    case 'invalid':
      return 'result-differs';
    case 'origin-moved':
      return 'origin-moved';
    case 'head-moved':
      return 'head-moved';
    case 'push-failed':
      return 'push-failed';
    case 'blocked':
      return 'blocked';
    case 'conflict':
    case 'hook':
    case 'failed':
    case undefined:
      return 'failed';
    default: {
      const exhaustive: never = reason;
      return exhaustive;
    }
  }
};

const WORDS: Readonly<Record<RebaseJobState, string>> = {
  checking: 'Checking',
  replaying: 'Replaying',
  merging: 'Merging',
  'checking-result': 'Checking',
  waiting: 'Waiting',
  moving: 'Moving',
  'updating-online': 'Pushing',
  done: 'Done',
  dirty: 'Stopped',
  stuck: 'Stopped',
  'no-provider': 'Stopped',
  'result-differs': 'Stopped',
  'origin-moved': 'Stopped',
  'head-moved': 'Stopped',
  'push-failed': 'Stopped',
  blocked: 'Stopped',
  failed: 'Stopped',
};

type WordOfParams = {
  readonly state: RebaseJobState;
  readonly run: HistoryRun;
};

const wordOf = ({ state, run }: WordOfParams) => {
  const word = WORDS[state];
  if (word !== 'Stopped') {
    return word;
  }
  const cause = historyStopCause({ reason: run.stop?.reason, message: run.stop?.message });
  return cause === null ? word : `${word}: ${cause}`;
};

const copyOf = ({
  state,
  run,
  projectName,
  baseBranch,
  commitCount,
  dirtyCount,
}: Params & { readonly state: RebaseJobState }): Copy => {
  const running = `Rebasing ${projectName} on ${baseBranch}`;
  const stop = run.stop;
  const message = stop?.message ?? '';
  switch (state) {
    case 'checking':
      return { tone: 'info', title: running, line: 'Checking the branch' };
    case 'replaying':
      return { tone: 'info', title: running, line: replayLineOf({ run }) };
    case 'merging':
      return {
        tone: 'info',
        title: running,
        line: `History rewriter is merging ${filesLabelOf({ files: stop?.files ?? [] })} in a copy`,
      };
    case 'checking-result':
      return { tone: 'info', title: running, line: 'Checking the result against your branch' };
    case 'waiting':
      return {
        tone: 'info',
        title: running,
        line: `${run.holder ?? 'An agent'} is writing here. The branch moves when it stops.`,
      };
    case 'moving':
      return {
        tone: 'info',
        title: running,
        line: 'Moving the branch. A backup is saved first.',
      };
    case 'updating-online':
      return {
        tone: 'info',
        title: running,
        line: 'Updating the online copy with a safe force push',
      };
    case 'done':
      return {
        tone: 'ok',
        title: `Rebased on ${baseBranch}`,
        line: `${commitsOf({ count: commitCount })}${keptFilesOf({ count: dirtyCount })} Backup kept for 30 days.`.trim(),
      };
    case 'dirty':
      return {
        tone: 'warn',
        title: dirtyTitleOf({ count: dirtyCount }),
        line: 'Commit or stash them, then check again.',
      };
    case 'stuck':
      return {
        tone: 'warn',
        title: 'History rewriter needs you',
        line: `It could not merge ${filesLabelOf({ files: stop?.files ?? [] })}.`,
      };
    case 'no-provider':
      return {
        tone: 'warn',
        title: 'No provider is connected',
        line: 'History rewriter needs one to merge the conflict.',
      };
    case 'result-differs':
      return {
        tone: 'warn',
        title: 'The result did not match your branch',
        line: 'Nothing was changed. Details has the output.',
        detail: message.trim() === '' ? null : message.trim(),
      };
    case 'origin-moved':
      return {
        tone: 'warn',
        title: 'Someone pushed to the online copy',
        line: 'Nothing was pushed.',
      };
    case 'head-moved':
      return { tone: 'warn', title: 'The branch moved', line: 'Nothing was changed.' };
    case 'push-failed':
      return {
        tone: 'danger',
        title: 'Rebased, but the push failed',
        line:
          historyStopCause({ reason: stop?.reason, message }) === 'hook stopped the push'
            ? 'A pre-push hook stopped it. Details has the output.'
            : 'The online copy was not updated. Details has the output.',
        detail: message.trim() === '' ? null : message.trim(),
      };
    case 'blocked':
      return {
        tone: 'warn',
        title: "Couldn't move the branch",
        line: firstLineOf({ text: message }),
        detail: detailOf({ text: message }),
      };
    case 'failed':
      return {
        tone: 'danger',
        title: `Couldn't rebase ${projectName} on ${baseBranch}`,
        line: firstLineOf({ text: message }),
        detail: detailOf({ text: message }),
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

type RebaseJobStateOfParams = {
  readonly run: HistoryRun;
};

const rebaseJobStateOf = ({ run }: RebaseJobStateOfParams): RebaseJobState => {
  if (run.phase === 'stopped') {
    return stoppedStateOf({ run });
  }
  if (run.phase === 'applied' || run.phase === 'pushed') {
    return 'done';
  }
  return runningStateOf({ run });
};

export const rebaseJobOf = (params: Params): RebaseJob | null => {
  const { run } = params;
  if (run.origin !== 'rebase' || run.phase === 'restored' || run.phase === 'rewritten') {
    return null;
  }
  const state = rebaseJobStateOf({ run });
  const copy = copyOf({ ...params, state });
  const isRunning = isHistoryRunActive({ phase: run.phase });
  return {
    state,
    tone: copy.tone,
    isRunning,
    isSettled: !isRunning,
    title: copy.title,
    line: copy.line,
    detail: copy.detail ?? null,
    word: wordOf({ state, run }),
  };
};
