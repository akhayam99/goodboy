import { insertTurnFileSet } from '@goodboy/db';
import type { Project, ProviderRunId, SessionId, SessionProjectMount } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import {
  worktreeSnapshot,
  worktreeTurnFiles,
  type TurnBefore,
} from '../../../../features/worktree/worktree';
import { resolveMountBaseBranch } from '../../project-mounts/selectors';

type BeginParams = {
  readonly mounts: ReadonlyArray<SessionProjectMount>;
};

type BegunMount = {
  readonly mount: SessionProjectMount;
  readonly before: TurnBefore | null;
  readonly failure: unknown;
};

export const beginTurnFileSets = ({ mounts }: BeginParams): Promise<ReadonlyArray<BegunMount>> =>
  Promise.all(
    mounts
      .filter((mount) => mount.branch !== '' && mount.diskState === 'present')
      .map(async (mount): Promise<BegunMount> => {
        try {
          const snapshot = await worktreeSnapshot({ worktreePath: mount.worktreePath });
          return {
            mount,
            before: { head: snapshot.head, entries: snapshot.entries },
            failure: null,
          };
        } catch (error) {
          return { mount, before: null, failure: error };
        }
      }),
  );

type ReportParams = {
  readonly title: string;
  readonly error: unknown;
};

type RecordParams = {
  readonly reportError: (params: ReportParams) => Promise<void>;
  readonly sessionId: SessionId;
  readonly runId: ProviderRunId;
  readonly projects: ReadonlyArray<Project>;
  readonly begun: Promise<ReadonlyArray<BegunMount>>;
  readonly isShared: () => Promise<boolean>;
};

export const recordTurnFileSets = async ({
  reportError,
  sessionId,
  runId,
  projects,
  begun,
  isShared,
}: RecordParams): Promise<void> => {
  const failures: Array<unknown> = [];
  try {
    const [mounts, isSharedTurn] = await Promise.all([begun, isShared()]);
    if (isSharedTurn) {
      return;
    }
    for (const { mount, before, failure } of mounts) {
      if (before === null) {
        failures.push(failure);
        continue;
      }
      try {
        const found = await worktreeTurnFiles({
          worktreePath: mount.worktreePath,
          before,
          baseBranch: resolveMountBaseBranch({ mount, projects }),
        });
        await insertTurnFileSet({
          db: tauriDatabase,
          set: {
            runId,
            mountId: mount.mountId,
            sessionId,
            own: found.own,
            fromBase: found.fromBase,
            isPartial: found.isPartial,
            recordedAtMs: Date.now(),
          },
        });
      } catch (error) {
        failures.push(error);
      }
    }
  } catch (error) {
    failures.push(error);
  }
  const first = failures[0];
  if (first !== undefined) {
    await reportError({ title: "Couldn't record what this turn changed", error: first });
  }
};
