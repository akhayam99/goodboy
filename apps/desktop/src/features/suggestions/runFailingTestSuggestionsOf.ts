import type { SessionId } from '@goodboy/types';
import type { SuggestionMount } from './deriveNextSteps';
import type { SignalCheckLog, SignalScripts } from './nextStepSignals';
import { actionsJobOf } from './signals/actionsJobOf';
import { openPrOf } from './signals/openPrOf';
import { testCommandOf } from './signals/testCommandOf';
import type { SessionSuggestion } from './types';

type RunFailingTest = Extract<SessionSuggestion, { readonly kind: 'run-failing-test' }>;

type Params = {
  readonly sessionId: SessionId;
  readonly mounts: ReadonlyArray<SuggestionMount>;
  readonly checkLogs: ReadonlyArray<SignalCheckLog>;
  readonly scripts: ReadonlyArray<SignalScripts>;
};

export const runFailingTestSuggestionsOf = ({
  sessionId,
  mounts,
  checkLogs,
  scripts,
}: Params): ReadonlyArray<RunFailingTest> =>
  mounts.flatMap((mount): ReadonlyArray<RunFailingTest> => {
    const pr = openPrOf({ pr: mount.pr });
    if (pr === null || pr.checks !== 'failure') {
      return [];
    }
    const scriptsOfMount = scripts.find((entry) => entry.mountId === mount.mountId);
    const group = scriptsOfMount?.groups.find((candidate) =>
      candidate.scripts.some((script) => script.name === 'test'),
    );
    const testScript = group?.scripts.find((script) => script.name === 'test');
    if (group === undefined || testScript === undefined) {
      return [];
    }
    for (const check of mount.failedChecks ?? []) {
      const reading = checkLogs.find((candidate) => candidate.detailsUrl === check.detailsUrl);
      const target = reading?.testFile ?? reading?.testName ?? null;
      if (
        actionsJobOf({ detailsUrl: check.detailsUrl }) === null ||
        reading === undefined ||
        reading.status !== 'ready' ||
        target === null
      ) {
        continue;
      }
      return [
        {
          id: `run-failing-test:${mount.mountId}`,
          kind: 'run-failing-test',
          priority: 45,
          band: 2,
          title: 'Run the failing test',
          detail: `${check.name} failed in ${target}`,
          sessionId,
          targetKey: `test:${mount.mountId}`,
          fingerprint: `run-failing-test:${mount.mountId}:${pr.number}:${check.name}:${target}`,
          payload: {
            mountId: mount.mountId,
            prNumber: pr.number,
            checkName: check.name,
            testName: target,
            command: testCommandOf({
              base: testScript.command,
              manager: group.manager,
              target,
              cwd: mount.worktreePath,
            }),
          },
        },
      ];
    }
    return [];
  });
