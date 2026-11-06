import type { ComponentType } from 'react';
import type { SessionId } from '@goodboy/types';
import { aMountView } from '../../../../../features/session/testing/aMountView';
import { useAppStore } from '../../../../../store';
import { C08RunScene } from '../u25/C08RunScene';
import { C09OrchestratedScene } from '../u25/C09OrchestratedScene';
import { BranchNextScene } from './BranchNextScene';
import { seedRunsByBranch, seedRunsEmpty } from './runsListSeed';

type BranchParams = {
  readonly sessionId: SessionId;
};

const putAgentsOnBranch = ({ sessionId }: BranchParams): void => {
  const state = useAppStore.getState();
  const mount = state.sessionProjectMounts[sessionId]?.[0];
  if (mount === undefined) {
    return;
  }
  const { mountId } = mount;
  useAppStore.setState({
    sessionMounts: {
      ...state.sessionMounts,
      [sessionId]: [
        {
          ...aMountView({
            key: 'branch-runs',
            sessionId,
            projectId: mount.projectId,
            projectName: 'payments-api',
            branch: mount.branch,
          }),
          id: mountId,
          worktreePath: mount.worktreePath,
        },
      ],
    },
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [sessionId]: (state.sessionPhaseRuns[sessionId] ?? []).map((agent) => ({
        ...agent,
        mountId,
      })),
    },
  });
};

export const U36_RUN_PAGES_SCENES = {
  'u36-p12-preset-page': () => <C08RunScene state="working" selection="overview" />,
  'u36-p12-preset-queued': () => <C08RunScene state="ready" selection="overview" />,
  'u36-p12-step-page': () => <C08RunScene state="ready" selection="implementer" />,
  'u36-p12-step-working': () => <C08RunScene state="working" selection="implementer" />,
  'u36-p12-run-done': () => <C08RunScene state="done" selection="overview" />,
  'u36-p12-orch-page': () => <C09OrchestratedScene state="running" page="document" />,
  'u36-p12-orch-step-page': () => <C09OrchestratedScene state="running" page="stepPage" />,
  'u36-p12-orch-step-blocked': () => <C09OrchestratedScene state="step-blocked" page="stepPage" />,
  'u36-p12-orch-done': () => <C09OrchestratedScene state="done" page="document" />,
  'u36-p14-form-how-open': () => (
    <C08RunScene state="working" selection="list" click="how" extra={seedRunsEmpty} />
  ),
  'u36-f5-row-rename': () => (
    <C08RunScene state="working" selection="list" click="titleDouble" extra={seedRunsByBranch} />
  ),
  'u36-f3-branch-runs': () => <BranchNextScene phase="running" extra={putAgentsOnBranch} />,
} satisfies Readonly<Record<string, ComponentType>>;
