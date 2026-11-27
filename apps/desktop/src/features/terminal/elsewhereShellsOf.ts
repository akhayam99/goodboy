import type { SessionId } from '@goodboy/types';
import type { TerminalGroup } from './terminalWorktrees';

export type ElsewhereShell = {
  readonly key: string;
  readonly sessionId: SessionId;
  readonly sessionTitle: string;
  readonly label: string;
  readonly path: string | null;
  readonly runningCount: number;
};

type Params = {
  readonly groups: ReadonlyArray<TerminalGroup>;
  readonly sessionId: SessionId | null;
};

type CountParams = {
  readonly shells: ReadonlyArray<ElsewhereShell>;
};

export const elsewhereShellsOf = ({ groups, sessionId }: Params): ReadonlyArray<ElsewhereShell> =>
  groups
    .filter(
      (group) =>
        group.kind === 'session' && group.sessionId !== null && group.sessionId !== sessionId,
    )
    .flatMap((group) =>
      group.worktrees.flatMap((worktree) => {
        const runningCount = worktree.tabs.filter((tab) => tab.status !== 'exited').length;
        if (group.sessionId === null || runningCount === 0) {
          return [];
        }
        const place =
          worktree.branch === null
            ? worktree.projectName
            : `${worktree.projectName} · ${worktree.branch}`;
        return [
          {
            key: `elsewhere:${group.key}:${worktree.key}`,
            sessionId: group.sessionId,
            sessionTitle: group.title,
            label: `${group.title} · ${place}`,
            path: worktree.path,
            runningCount,
          },
        ];
      }),
    );

export const elsewhereCountOf = ({ shells }: CountParams): number =>
  shells.reduce((total, shell) => total + shell.runningCount, 0);

export const elsewhereNoteOf = ({ shells }: CountParams): string | null => {
  const count = elsewhereCountOf({ shells });
  if (count === 0) {
    return null;
  }
  return count === 1
    ? '1 shell running in other sessions'
    : `${count} shells running in other sessions`;
};
