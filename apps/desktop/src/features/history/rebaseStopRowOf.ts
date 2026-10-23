import type { MountId } from '@goodboy/types';
import { distanceBehind } from '../../shared/lib/gitStatus';
import { isInSyncWithOrigin } from './isInSyncWithOrigin';
import { conflictFilesLabelOf } from './rebaseConflictLine';
import { rebaseConflictOf } from './rebaseConflictOf';
import { rebaseJobOf, type RebaseJobState } from './rebaseJob';
import type { RebaseStop } from './rebaseStopOf';

type RebaseStopVerb = 'resolve-auto' | 'bring-in' | 'retry-rebase' | 'fix-push' | 'open';

export type RebaseStopRow = {
  readonly mountId: MountId;
  readonly state: RebaseJobState;
  readonly sentence: string;
  readonly verb: RebaseStopVerb;
  readonly isAsking: boolean;
  readonly canKeep: boolean;
  readonly hasBackup: boolean;
};

type Params = {
  readonly stop: RebaseStop;
  readonly baseBranch: string;
  readonly projectName: string;
};

type FilesParams = {
  readonly count: number;
};

const filesOf = ({ count }: FilesParams): string => `${count} ${count === 1 ? 'file' : 'files'}`;

type PathParams = {
  readonly path: string;
};

const nameOf = ({ path }: PathParams): string => path.split('/').at(-1) ?? path;

const RETRY_STATES: ReadonlySet<RebaseJobState> = new Set<RebaseJobState>([
  'dirty',
  'head-moved',
  'blocked',
  'result-differs',
  'failed',
]);

type VerbParams = {
  readonly state: RebaseJobState;
  readonly isFixing: boolean;
};

const verbOf = ({ state, isFixing }: VerbParams): RebaseStopVerb => {
  if (state === 'conflict') {
    return 'resolve-auto';
  }
  if (state === 'origin-moved') {
    return 'bring-in';
  }
  if (state === 'push-failed') {
    return isFixing ? 'open' : 'fix-push';
  }
  return RETRY_STATES.has(state) ? 'retry-rebase' : 'open';
};

type SentenceParams = {
  readonly state: RebaseJobState;
  readonly title: string;
  readonly files: ReadonlyArray<string>;
  readonly isHook: boolean;
  readonly baseBranch: string;
};

const conflictSentenceOf = ({ files, isHook, baseBranch }: SentenceParams): string => {
  if (isHook) {
    return 'A commit hook stopped it. Your branch is as it was.';
  }
  if (files.length === 0) {
    return 'It stopped on a conflict. Your branch is as it was.';
  }
  const verb = files.length === 1 ? 'conflicts' : 'conflict';
  const names = conflictFilesLabelOf({ files: files.map((path) => nameOf({ path })) });
  return `${filesOf({ count: files.length })} ${verb} with ${baseBranch}: ${names}. Your branch is as it was.`;
};

const sentenceOf = ({ state, title, files, isHook, baseBranch }: SentenceParams): string => {
  if (state === 'conflict') {
    return conflictSentenceOf({ state, title, files, isHook, baseBranch });
  }
  if (state === 'rebasing-here') {
    return `You are resolving ${filesOf({ count: files.length })} in the terminal.`;
  }
  if (state === 'auto-resolving') {
    return `Auto is resolving ${filesOf({ count: files.length })}.`;
  }
  if (state === 'auto-done' || state === 'rebased-here') {
    return `Rebased on ${baseBranch}. Push to update origin.`;
  }
  if (state === 'origin-moved') {
    return 'Rebased here, but someone pushed to origin. Nothing was pushed.';
  }
  return title.endsWith('.') ? title : `${title}.`;
};

export const rebaseStopRowOf = ({
  stop,
  baseBranch,
  projectName,
}: Params): RebaseStopRow | null => {
  const { run, status } = stop;
  const job = rebaseJobOf({
    run,
    projectName,
    baseBranch,
    commitCount: run.commitCount,
    dirtyCount: null,
    behind: status === null ? null : distanceBehind({ distance: status.mainDistance }),
    isRebasingHere: status?.inProgress === 'rebase',
    isInSyncWithOrigin: isInSyncWithOrigin({ status }),
  });
  if (job === null) {
    return null;
  }
  const conflict = rebaseConflictOf({ run });
  const files = conflict?.files ?? [];
  const sentence = sentenceOf({
    state: job.state,
    title: job.title,
    files,
    isHook: conflict?.isHook === true,
    baseBranch,
  });
  return {
    mountId: run.mountId,
    state: job.state,
    sentence,
    verb: verbOf({ state: job.state, isFixing: run.pushFix !== undefined }),
    isAsking: job.state === 'conflict',
    canKeep: job.state === 'conflict' || RETRY_STATES.has(job.state),
    hasBackup: run.backupRef !== null,
  };
};
