import type { SessionId } from '@goodboy/types';
import type { SuggestionMount } from './deriveNextSteps';
import type { SignalCheckLog } from './nextStepSignals';
import { actionsJobOf } from './signals/actionsJobOf';
import { openPrOf } from './signals/openPrOf';
import type { SessionSuggestion } from './types';

type RerunCheck = Extract<SessionSuggestion, { readonly kind: 'rerun-check' }>;

type Params = {
  readonly sessionId: SessionId;
  readonly mounts: ReadonlyArray<SuggestionMount>;
  readonly checkLogs: ReadonlyArray<SignalCheckLog>;
};

export const rerunCheckSuggestionsOf = ({
  sessionId,
  mounts,
  checkLogs,
}: Params): ReadonlyArray<RerunCheck> =>
  mounts.flatMap((mount): ReadonlyArray<RerunCheck> => {
    const pr = openPrOf({ pr: mount.pr });
    if (pr === null || pr.checks !== 'failure') {
      return [];
    }
    for (const check of mount.failedChecks ?? []) {
      const job = actionsJobOf({ detailsUrl: check.detailsUrl });
      const reading = checkLogs.find((candidate) => candidate.detailsUrl === check.detailsUrl);
      if (
        job === null ||
        check.detailsUrl === null ||
        reading === undefined ||
        reading.status !== 'ready' ||
        !reading.isTimeout
      ) {
        continue;
      }
      return [
        {
          id: `rerun-check:${mount.mountId}`,
          kind: 'rerun-check',
          priority: 13,
          band: 1,
          title: `Rerun ${check.name}`,
          detail: `${check.name} timed out on #${pr.number}, as the job log says`,
          sessionId,
          targetKey: `pr:${mount.mountId}`,
          fingerprint: `rerun-check:${mount.mountId}:${pr.number}:${job.runId}`,
          payload: {
            mountId: mount.mountId,
            prNumber: pr.number,
            checkName: check.name,
            detailsUrl: check.detailsUrl,
            runId: job.runId,
            cwd: mount.worktreePath,
          },
        },
      ];
    }
    return [];
  });
