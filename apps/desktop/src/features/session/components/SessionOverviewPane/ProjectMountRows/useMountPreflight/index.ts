import { useEffect, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { MountId, Project, SessionId } from '@goodboy/types';
import { listBranchNames } from '../../../../../worktree/worktree';
import { useAppStore } from '../../../../../../store';
import { allocateMountDirName } from '../../../../../../store/slices/project-mounts/allocateMountDirName';
import { mountPlan } from '../../../../../../store/slices/sessions/mountPlan';
import { resolveMountPreflight, type MountPreflight } from './resolveMountPreflight';

export type MountPreflightState = {
  readonly status: 'idle' | 'checking' | 'ready';
  readonly preflight: MountPreflight | null;
  readonly branchScanError: string | null;
};

type Params = {
  readonly sessionId: SessionId;
  readonly project: Project | null;
};

const IDLE = {
  status: 'idle',
  preflight: null,
  branchScanError: null,
} satisfies MountPreflightState;

export const useMountPreflight = ({ sessionId, project }: Params): MountPreflightState => {
  const [state, setState] = useState<MountPreflightState>(IDLE);
  const projectId = project?.id ?? null;

  useEffect(() => {
    if (project === null || projectId === null) {
      setState(IDLE);
      return;
    }
    let isCurrent = true;
    const planningState = useAppStore.getState();
    const plan = mountPlan({
      state: planningState,
      sessionId,
      projectId,
      mountId: crypto.randomUUID() as MountId,
    });
    if (plan === null) {
      setState(IDLE);
      return;
    }
    if (project.kind !== 'repo') {
      setState({
        status: 'ready',
        preflight: resolveMountPreflight({ plan, repoBranches: [] }),
        branchScanError: null,
      });
      return;
    }
    setState({
      status: 'checking',
      preflight: null,
      branchScanError: null,
    });
    Promise.all([
      listBranchNames({ repoPath: project.rootPath })
        .then((repoBranches) => ({ repoBranches, error: null }))
        .catch((error: unknown) => ({ repoBranches: [], error: formatError(error) })),
      allocateMountDirName({
        mountId: plan.mountId,
        repoPath: project.rootPath,
        parentDir: `${project.rootPath}/.goodboy/worktrees`,
      }),
    ])
      .then(([scan, dirName]) => {
        if (!isCurrent) {
          return;
        }
        const allocated = mountPlan({
          state: planningState,
          sessionId,
          projectId,
          mountId: plan.mountId,
          dirName,
        });
        if (allocated === null) {
          return;
        }
        setState({
          status: 'ready',
          preflight: resolveMountPreflight({ plan: allocated, repoBranches: scan.repoBranches }),
          branchScanError: scan.error,
        });
      })
      .catch((error: unknown) => {
        if (!isCurrent) {
          return;
        }
        setState({
          status: 'ready',
          preflight: null,
          branchScanError: formatError(error),
        });
      });
    return () => {
      isCurrent = false;
    };
  }, [projectId, project, sessionId]);

  return state;
};
