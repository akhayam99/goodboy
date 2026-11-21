import { useEffect } from 'react';
import {
  brandId,
  type IsoDateTime,
  type SessionMountView,
  type SessionProjectMount,
  type WorktreeDetachAssessment,
  type WorktreeStatus,
} from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { PROJECT_DETACH_EVENT, projectKeyOf } from '../../../../../features/actions/kinds/project';
import { CTX_STATUS } from '../brand/contextBranch';
import { mockSceneIpc } from '../mockSceneIpc';
import { CentralColumnScene } from '../u26/CentralColumnScene';
import { COLUMN_SESSION_ID } from '../u26/centralColumnSeed';

type Props = {
  readonly theme: 'dark' | 'light';
  readonly isConfirmOpen: boolean;
};

type ViewParams = {
  readonly mount: SessionProjectMount;
};

type AnswerParams = {
  readonly payload: unknown;
};

type CommandParams = {
  readonly command: string;
  readonly payload: unknown;
};

const MOUNTED_AT = brandId<IsoDateTime>({ value: '2026-10-18T09:00:00.000Z' });

const CONFIRM_DELAY_MS = 400;

const CURRENT_STATUS: WorktreeStatus = {
  ...CTX_STATUS,
  mainDistance: { kind: 'known', ahead: 3, behind: 0 },
  upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
};

const assessedOf = ({ payload }: AnswerParams): WorktreeDetachAssessment => ({
  kind: 'assessed',
  path:
    typeof payload === 'object' && payload !== null && 'worktreePath' in payload
      ? String(payload.worktreePath)
      : '',
  branch: CTX_STATUS.branch ?? '',
  hasUpstream: true,
  affectedFiles: 0,
  localOnlyCommits: 0,
  ignoredFiles: 0,
  ignoredFileSamples: [],
  integration: { kind: 'merged', base: 'origin/main' },
});

const answerOf = ({ command, payload }: CommandParams): unknown => {
  if (command === 'worktree_status') {
    return CURRENT_STATUS;
  }
  if (command === 'worktree_detach_assessment') {
    return assessedOf({ payload });
  }
  return null;
};

const viewOf = ({ mount }: ViewParams): SessionMountView => ({
  id: mount.mountId,
  sessionId: mount.sessionId,
  projectId: mount.projectId,
  worktreePath: mount.worktreePath,
  lastWorktreePath: mount.lastWorktreePath,
  branch: mount.branch,
  baseBranch: mount.baseBranch,
  parallelIndex: mount.parallelIndex,
  mountName: mount.mountName,
  repoSlug: null,
  isAttached: mount.isAttached,
  diskState: mount.diskState,
  revision: mount.revision,
  createdAt: MOUNTED_AT,
  updatedAt: MOUNTED_AT,
  repoRoot: mount.repoRoot,
});

export const MountFixScene = ({ theme, isConfirmOpen }: Props) => {
  useEffect(() => {
    mockSceneIpc((command, payload) => answerOf({ command, payload }));
    const mounts = useAppStore.getState().sessionProjectMounts[COLUMN_SESSION_ID] ?? [];
    useAppStore.setState((state) => ({
      sessionMounts: {
        ...state.sessionMounts,
        [COLUMN_SESSION_ID]: mounts.map((mount) => viewOf({ mount })),
      },
    }));
    const first = mounts[0];
    if (!isConfirmOpen || first === undefined) {
      return;
    }
    let timer = 0;
    const request = () => {
      if (document.querySelector('[data-board-project-head] button') === null) {
        timer = window.setTimeout(request, CONFIRM_DELAY_MS);
        return;
      }
      window.dispatchEvent(
        new CustomEvent(PROJECT_DETACH_EVENT, {
          detail: {
            projectKey: projectKeyOf({ sessionId: COLUMN_SESSION_ID, projectId: first.projectId }),
          },
        }),
      );
    };
    timer = window.setTimeout(request, CONFIRM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isConfirmOpen]);
  return <CentralColumnScene theme={theme} kind="finished" />;
};
