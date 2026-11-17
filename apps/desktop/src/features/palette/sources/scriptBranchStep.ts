import type { MountId, SessionId, SessionProjectMount } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';
import { branchPushStateOf } from '../../../shared/lib/branchPushState';
import {
  readWorktreeStatus,
  worktreeStatusKey,
} from '../../../store/runtime/worktreeStatuses/cache';
import { projectById } from '../../../store/slices/projects/projectIndex';
import type { AppState } from '../../../store/types';
import { resolveScriptMount } from '../../scripts/resolveScriptMount';
import type { PaletteEntry, PaletteStep } from '../types';
import type { PinnedScriptTarget } from './scriptPinEntries';

export type ScriptRunOnParams = {
  readonly target: PinnedScriptTarget;
  readonly mountId: MountId;
};

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly target: PinnedScriptTarget;
  readonly runOn: (params: ScriptRunOnParams) => void;
};

type PushParams = {
  readonly mount: SessionProjectMount;
};

const pushWordOf = ({ mount }: PushParams): string | null => {
  const status = readWorktreeStatus(
    worktreeStatusKey({
      worktreePath: mount.worktreePath,
      baseBranch: mount.baseBranch ?? undefined,
    }),
  );
  if (status === null) {
    return null;
  }
  const push = branchPushStateOf({ status });
  switch (push.kind) {
    case 'not-pushed':
      return 'Not pushed';
    case 'ahead':
    case 'diverged':
      return `${push.ahead} ahead`;
    case 'in-sync':
    case 'behind':
    case 'gone':
    case 'unknown':
      return null;
    default: {
      const exhaustive: never = push;
      return exhaustive;
    }
  }
};

export const scriptBranchStep = ({
  state,
  sessionId,
  target,
  runOn,
}: Params): PaletteStep | null => {
  const outcome = resolveScriptMount({
    state,
    sessionId,
    projectId: target.projectId,
    mountId: null,
  });
  if (outcome.kind !== 'ask') {
    return null;
  }
  const entries = outcome.mounts.map((mount): PaletteEntry => {
    const projectName = projectById(state.projects, mount.projectId)?.name ?? mount.mountName;
    const push = pushWordOf({ mount });
    return {
      key: `script-branch:${mount.mountId}`,
      label: mount.branch === '' ? mount.mountName : mount.branch,
      kind: 'script',
      group: null,
      icon: CONCEPT_ICONS.branch,
      detail: push === null ? projectName : `${projectName} · ${push}`,
      run: () => runOn({ target, mountId: mount.mountId }),
    };
  });
  return {
    title: `Run ${target.name} on which branch?`,
    placeholder: 'Filter branches…',
    entries,
  };
};
