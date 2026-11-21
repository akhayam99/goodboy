import type { NextStepSignals } from './nextStepSignals';
import { QUIET_WINDOW_MS } from './signals/QUIET_WINDOW_MS';
import type { CompletesWhen } from './types';

type Params = {
  readonly completesWhen: CompletesWhen;
  readonly signals: NextStepSignals;
};

export const isMoveDone = ({ completesWhen, signals }: Params): boolean => {
  const mounts = signals.mounts ?? [];
  switch (completesWhen.kind) {
    case 'check-passes':
      return (
        mounts.find((mount) => mount.mountId === completesWhen.mountId)?.pr?.checks === 'success'
      );
    case 'script-succeeds':
      return (signals.scriptRuns ?? []).some(
        (run) =>
          run.isOk &&
          run.name === completesWhen.scriptName &&
          (completesWhen.mountId === null || run.mountId === completesWhen.mountId),
      );
    case 'folder-mounted':
      return new Set(signals.projects.map((project) => project.projectId)).has(
        completesWhen.projectId,
      );
    case 'folder-unmounted':
      return !new Set(signals.projects.map((project) => project.mountId)).has(
        completesWhen.mountId,
      );
    case 'worktree-removed':
      return (
        !(signals.cleanupProposals ?? []).some(
          (proposal) => proposal.mountId === completesWhen.mountId,
        ) &&
        !(signals.mergedMounts ?? []).some((merged) => merged.mountId === completesWhen.mountId) &&
        !(signals.idleMounts ?? []).some((idle) => idle.mountId === completesWhen.mountId)
      );
    case 'agent-answers': {
      const quiet = (signals.quietAgents ?? []).find(
        (agent) => agent.agentId === completesWhen.agentId,
      );
      return quiet === undefined || quiet.quietMs < QUIET_WINDOW_MS.ask;
    }
    case 'pr-merged': {
      const mount = mounts.find((candidate) => candidate.mountId === completesWhen.mountId);
      return mount === undefined || mount.pr?.state === 'merged';
    }
    case 'rebase-finished':
      return !signals.projects.some(
        (candidate) =>
          candidate.mountId === completesWhen.mountId &&
          (candidate.rebaseStop != null || (candidate.mainDistance ?? 0) > 0),
      );
    case 'move-gone':
      return true;
    default: {
      const exhaustive: never = completesWhen;
      return exhaustive;
    }
  }
};
