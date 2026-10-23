import { isHistoryRunActive } from '../../store/slices/history/isHistoryRunActive';
import type { HistoryRun } from '../../store/slices/history/types';
import { historyStopCause } from './historyStopCause';
import { pushErrorLine } from './pushErrorLine';
import { rebaseConflictOf } from './rebaseConflictOf';
import { conflictFilesLabelOf } from './rebaseConflictLine';
import type { RebaseFileStates } from './rebaseFileStatesOf';

export type RebaseJobState =
  | 'choosing'
  | 'restore-conflict'
  | 'set-aside'
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
  | 'fixing-push'
  | 'blocked'
  | 'conflict'
  | 'rebasing-here'
  | 'rebased-here'
  | 'auto-resolving'
  | 'auto-done'
  | 'pushed'
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
  readonly progress: string | null;
};

type Params = {
  readonly run: HistoryRun;
  readonly projectName: string;
  readonly baseBranch: string;
  readonly commitCount: number | null;
  readonly dirtyCount: number | null;
  readonly behind?: number | null;
  readonly isRebasingHere?: boolean;
  readonly isInSyncWithOrigin?: boolean;
  readonly files?: RebaseFileStates | null;
  readonly originCount?: number | null;
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

type PushFailureLineParams = {
  readonly reason: string | undefined;
  readonly message: string;
};

const pushFailureLine = ({ reason, message }: PushFailureLineParams): string => {
  const picked = pushErrorLine({ message });
  if (picked !== '') {
    return picked;
  }
  return historyStopCause({ reason, message }) === 'hook stopped the push'
    ? 'A pre-push hook stopped it.'
    : 'The online copy was not updated.';
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

type CountLabelParams = {
  readonly count: number;
  readonly one: string;
  readonly many: string;
};

const countLabelOf = ({ count, one, many }: CountLabelParams): string =>
  `${count} ${count === 1 ? one : many}`;

type StopTitleParams = {
  readonly files: ReadonlyArray<string>;
  readonly baseBranch: string;
  readonly isHook: boolean;
};

const conflictTitleOf = ({ files, baseBranch, isHook }: StopTitleParams): string => {
  if (isHook) {
    return `A commit hook stopped the rebase on ${baseBranch}`;
  }
  if (files.length === 0) {
    return `Rebase on ${baseBranch} stopped on a conflict`;
  }
  const verb = files.length === 1 ? 'conflicts' : 'conflict';
  return `Rebase on ${baseBranch} stopped: ${countLabelOf({ count: files.length, one: 'file', many: 'files' })} ${verb}`;
};

const CONFLICT_LINE =
  'Your branch is as it was. The rebase ran on a copy, so nothing changes until you pick.';

type FilesLineParams = {
  readonly files: RebaseFileStates | null | undefined;
};

const hereLineOf = ({ files }: FilesLineParams): string => {
  if (files === null || files === undefined || !files.isKnown || files.total === 0) {
    return 'Resolve the conflict in the terminal or your editor, then continue here.';
  }
  const progress = `${files.left} of ${countLabelOf({ count: files.total, one: 'file', many: 'files' })} left.`;
  if (files.toStage > 0) {
    return `${progress} A binary or deleted file has no markers: stage it with git add or git rm and it turns green here.`;
  }
  return `${progress} Save a file without conflict markers and it turns green here.`;
};

const autoLineOf = ({ files }: FilesLineParams): string => {
  if (files === null || files === undefined || !files.isKnown || files.total === 0) {
    return 'It asks you in the session when a conflict is not clear.';
  }
  return `${files.resolved} of ${countLabelOf({ count: files.total, one: 'file', many: 'files' })} resolved. It asks you here if a conflict is not clear.`;
};

type OriginTitleParams = {
  readonly count: number | null | undefined;
};

const originTitleOf = ({ count }: OriginTitleParams): string =>
  count === null || count === undefined || count === 0
    ? 'Rebased here, but someone pushed to origin'
    : `Rebased here, but origin has ${countLabelOf({ count, one: 'new commit', many: 'new commits' })}`;

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

const progressOf = ({ run }: ReplayLineOfParams): string | null =>
  run.progress?.stage === 'step' && run.progress.index > 0
    ? `${run.progress.index} of ${run.progress.total}`
    : null;

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
  if (reason === 'push-failed' && run.pushFix !== undefined) {
    return 'fixing-push';
  }
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
  choosing: 'Choose',
  'restore-conflict': 'Saved',
  'set-aside': 'Saved',
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
  'fixing-push': 'Fixing',
  blocked: 'Stopped',
  conflict: 'Conflict',
  'rebasing-here': 'Rebasing',
  'rebased-here': 'Done',
  'auto-resolving': 'Auto',
  'auto-done': 'Done',
  pushed: 'Done',
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
  files,
  originCount,
}: Params & { readonly state: RebaseJobState }): Copy => {
  const running = `Rebasing ${projectName} on ${baseBranch}`;
  const stop = run.stop;
  const message = stop?.message ?? '';
  switch (state) {
    case 'choosing':
      return {
        tone: 'warn',
        title: dirtyTitleOf({ count: run.dirtyChoice?.dirtyCount ?? null }),
        line: `${run.dirtyChoice?.files.length ?? 0} of them are also changed on ${baseBranch}. Goodboy sets them aside and brings them back.`,
      };
    case 'restore-conflict':
      return {
        tone: 'warn',
        title: `Rebased on ${baseBranch}, but ${run.savedStash?.files.length ?? 0} of your files conflict`,
        line: 'They are saved in a stash. Nothing is lost.',
      };
    case 'set-aside':
      return {
        tone: 'warn',
        title: 'Your files from the last rebase are still set aside.',
        line: 'Bring them back when you are ready.',
      };
    case 'checking':
      return { tone: 'info', title: running, line: 'Checking the branch' };
    case 'replaying':
      return { tone: 'info', title: running, line: replayLineOf({ run }) };
    case 'merging':
      return {
        tone: 'info',
        title: running,
        line: `History rewriter is merging ${conflictFilesLabelOf({ files: stop?.files ?? [] })} in a copy`,
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
        line: `${commitsOf({ count: commitCount })}${keptFilesOf({ count: run.carriedCount ?? dirtyCount })} Backup kept for 30 days.`.trim(),
      };
    case 'dirty':
      return {
        tone: 'warn',
        title: dirtyTitleOf({ count: dirtyCount }),
        line: 'Commit or stash them, then retry the rebase.',
      };
    case 'stuck':
      return {
        tone: 'warn',
        title: 'History rewriter needs you',
        line: `It could not merge ${conflictFilesLabelOf({ files: stop?.files ?? [] })}.`,
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
        title: originTitleOf({ count: originCount }),
        line: 'Someone pushed to this branch while you rebased. Nothing was pushed. Bring them in adds their commits to yours, then pushes.',
      };
    case 'head-moved':
      return { tone: 'warn', title: 'The branch moved', line: 'Nothing was changed.' };
    case 'push-failed':
      return {
        tone: 'danger',
        title: 'Rebased, but the push failed',
        line: pushFailureLine({ reason: stop?.reason, message }),
        detail: message.trim() === '' ? null : message.trim(),
      };
    case 'fixing-push':
      return {
        tone: 'info',
        title: 'Rebased, fixing the push',
        line: 'An agent is fixing what stopped it. The push runs again when it finishes.',
      };
    case 'blocked':
      return {
        tone: 'warn',
        title: "Couldn't move the branch",
        line: firstLineOf({ text: message }),
        detail: detailOf({ text: message }),
      };
    case 'conflict': {
      const conflict = rebaseConflictOf({ run });
      return {
        tone: 'warn',
        title: conflictTitleOf({
          files: conflict?.files ?? [],
          baseBranch: conflict?.baseBranch ?? baseBranch,
          isHook: conflict?.isHook ?? false,
        }),
        line: CONFLICT_LINE,
      };
    }
    case 'rebasing-here':
      return {
        tone: 'info',
        title: `You are rebasing on ${baseBranch} in the terminal`,
        line: hereLineOf({ files }),
      };
    case 'auto-resolving':
      return {
        tone: 'info',
        title: `Auto is rebasing on ${baseBranch}`,
        line: autoLineOf({ files }),
      };
    case 'auto-done':
      return {
        tone: 'ok',
        title: `Rebased on ${baseBranch}`,
        line: `${commitsOf({ count: commitCount })} Auto resolved the conflict. Origin still has the old copy.`.trim(),
      };
    case 'rebased-here':
      return {
        tone: 'ok',
        title: `Rebased on ${baseBranch}`,
        line: `${commitsOf({ count: commitCount })} Origin still has the old copy.`.trim(),
      };
    case 'pushed':
      return {
        tone: 'ok',
        title: 'Pushed to origin',
        line: `The branch is rebased on ${baseBranch} and origin has it.`,
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
  readonly behind: number | null;
  readonly isRebasingHere: boolean;
  readonly isInSyncWithOrigin: boolean;
};

const rebaseJobStateOf = ({
  run,
  behind,
  isRebasingHere,
  isInSyncWithOrigin,
}: RebaseJobStateOfParams): RebaseJobState => {
  const conflict = rebaseConflictOf({ run });
  if (conflict !== null) {
    const isAuto = conflict.autoAgentId !== null;
    if (isRebasingHere) {
      return isAuto ? 'auto-resolving' : 'rebasing-here';
    }
    if ((isAuto || conflict.isHere) && behind === 0) {
      if (isInSyncWithOrigin) {
        return 'pushed';
      }
      return isAuto ? 'auto-done' : 'rebased-here';
    }
    return isAuto ? 'auto-resolving' : 'conflict';
  }
  if (run.phase === 'choosing' || run.phase === 'restore-conflict' || run.phase === 'set-aside') {
    return run.phase;
  }
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
  if (
    (run.origin !== 'rebase' &&
      run.phase !== 'choosing' &&
      run.phase !== 'restore-conflict' &&
      run.phase !== 'set-aside') ||
    run.phase === 'restored' ||
    run.phase === 'rewritten'
  ) {
    return null;
  }
  const state = rebaseJobStateOf({
    run,
    behind: params.behind ?? null,
    isRebasingHere: params.isRebasingHere ?? false,
    isInSyncWithOrigin: params.isInSyncWithOrigin ?? false,
  });
  const copy = copyOf({ ...params, state });
  const isRunning =
    isHistoryRunActive({ phase: run.phase }) ||
    state === 'fixing-push' ||
    state === 'auto-resolving';
  return {
    state,
    tone: copy.tone,
    isRunning,
    isSettled: !isRunning,
    title: copy.title,
    line: copy.line,
    detail: copy.detail ?? null,
    word: wordOf({ state, run }),
    progress: isRunning ? progressOf({ run }) : null,
  };
};
