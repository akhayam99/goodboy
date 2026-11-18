import type { SessionId, WorkspaceId } from '@goodboy/types';
import type { useToast } from '../../shared/components/Toast';
import { useAppStore } from '../../store';
import { CHECK_STATE } from '../../store/slices/notifications/errorRecovery';
import type { AppStore } from '../../store/store';
import { resolveScriptMount } from '../scripts/resolveScriptMount';
import { runPinnedScript } from '../scripts/runPinnedScript';
import { scriptBranchStep, type ScriptRunOnParams } from './sources/scriptBranchStep';
import type { PinnedScriptTarget } from './sources/scriptPinEntries';
import type { PaletteStep } from './types';

type Params = {
  readonly sessionId: SessionId | null;
  readonly workspaceId: WorkspaceId | null;
  readonly showToast: ReturnType<typeof useToast>['showToast'];
  readonly reportError: AppStore['reportError'];
};

type TargetParams = {
  readonly target: PinnedScriptTarget;
};

export type PaletteScriptRunner = {
  readonly runHere: (params: TargetParams) => void;
  readonly stepFor: (params: TargetParams) => PaletteStep | null;
};

const missingOf = ({ target }: TargetParams): string =>
  `Open a session with ${target.projectName} to run ${target.name}.`;

export const paletteScriptRunner = ({
  sessionId,
  workspaceId,
  showToast,
  reportError,
}: Params): PaletteScriptRunner => {
  const runOn = ({ target, mountId }: ScriptRunOnParams): void => {
    if (sessionId === null || workspaceId === null) {
      showToast({ kind: 'warning', message: missingOf({ target }) });
      return;
    }
    const failureTitle = `Couldn't run ${target.name}`;
    void runPinnedScript({
      sessionId,
      workspaceId,
      projectId: target.projectId,
      mountId,
      pinId: target.pinId,
    })
      .then((outcome) => {
        if (outcome.kind === 'dropped') {
          return;
        }
        if (outcome.kind === 'not-here') {
          showToast({ kind: 'warning', message: missingOf({ target }) });
          return;
        }
        if (outcome.result.exitCode !== 0) {
          void reportError({
            title: failureTitle,
            error: outcome.result.stderr.startsWith('Already running')
              ? `${outcome.result.stderr}.`
              : `Exited with code ${outcome.result.exitCode}.`,
            sessionId,
            recovery: { action: { kind: 'open-lens', sessionId, lens: 'scripts' } },
          });
          return;
        }
        showToast({ kind: 'success', message: `${target.name} finished.` });
      })
      .catch((error: unknown) =>
        reportError({ recovery: CHECK_STATE, title: failureTitle, error, sessionId }),
      );
  };

  const runHere = ({ target }: TargetParams): void => {
    if (sessionId === null) {
      showToast({ kind: 'warning', message: missingOf({ target }) });
      return;
    }
    const outcome = resolveScriptMount({
      state: useAppStore.getState(),
      sessionId,
      projectId: target.projectId,
      mountId: null,
    });
    if (outcome.kind === 'run') {
      runOn({ target, mountId: outcome.mount.mountId });
      return;
    }
    const message =
      outcome.kind === 'ask' ? `Pick the branch to run ${target.name} on.` : missingOf({ target });
    showToast({ kind: 'warning', message });
  };

  const stepFor = ({ target }: TargetParams): PaletteStep | null =>
    sessionId === null
      ? null
      : scriptBranchStep({ state: useAppStore.getState(), sessionId, target, runOn });

  return { runHere, stepFor };
};
