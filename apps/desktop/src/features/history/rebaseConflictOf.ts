import type { AgentId } from '@goodboy/types';
import type { HistoryRun } from '../../store/slices/history/types';

export type RebaseConflictView = {
  readonly files: ReadonlyArray<string>;
  readonly count: number;
  readonly isHook: boolean;
  readonly baseBranch: string;
  readonly ontoRef: string | null;
  readonly head: string | null;
  readonly autoAgentId: AgentId | null;
  readonly isHere: boolean;
};

type Params = {
  readonly run: HistoryRun | null | undefined;
};

export const rebaseConflictOf = ({ run }: Params): RebaseConflictView | null => {
  if (
    run === null ||
    run === undefined ||
    run.origin !== 'rebase' ||
    run.phase !== 'stopped' ||
    run.rebaseConflict === undefined
  ) {
    return null;
  }
  const reason = run.stop?.reason;
  if (reason !== 'conflict' && reason !== 'hook') {
    return null;
  }
  const files = run.stop?.files ?? [];
  return {
    files,
    count: files.length,
    isHook: reason === 'hook',
    baseBranch: run.rebaseConflict.baseBranch,
    ontoRef: run.rebaseConflict.ontoRef,
    head: run.rebaseConflict.head,
    autoAgentId: run.rebaseConflict.autoAgentId,
    isHere: run.rebaseConflict.isHere === true,
  };
};
