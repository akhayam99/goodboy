import type { ReactNode } from 'react';
import { Unlink } from '@goodboy/ui/icons';
import { ICON_SIZE, IconButton } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import { selectProjectById } from '../../../../store/slices/projects/selectProjectById';
import {
  PROJECT_DETACH_EVENT,
  projectKeyOf,
  type ProjectDetachRequest,
} from '../../../actions/kinds/project';
import { NewBranchMountAction } from '../SessionOverviewPane/ProjectMountRows/NewBranchMountAction';
import { attachedBranchCountOf } from './attachedBranchCountOf';
import { sessionProjectIdsOf } from './sessionProjectIdsOf';
import { UNMOUNT_BLOCKED_REASON } from './unmountBlockedReason';
import { useBoardContext } from './useBoardContext';

type Props = {
  readonly projectId: ProjectId | null;
  readonly projectName: string;
  readonly door: ReactNode;
};

export const BoardProjectHead = ({ projectId, projectName, door }: Props) => {
  const ProjectIcon = CONCEPT_ICONS.projectRepo;
  const { session } = useBoardContext();
  const sessionId = session.id;
  const hasMounts = useAppStore(
    (state) => projectId !== null && sessionProjectIdsOf({ state, sessionId }).includes(projectId),
  );
  const isRepo = useAppStore(
    (state) => projectId !== null && selectProjectById(state, projectId)?.kind === 'repo',
  );
  const attachedCount = useAppStore((state) =>
    attachedBranchCountOf({ state, sessionId, projectId }),
  );
  const isUnmountBlocked = isRepo && attachedCount > 0;
  const requestDetach = () => {
    if (projectId === null || isUnmountBlocked) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent<ProjectDetachRequest>(PROJECT_DETACH_EVENT, {
        detail: { projectKey: projectKeyOf({ sessionId, projectId }) },
      }),
    );
  };
  return (
    <div data-board-project-head="" className="flex h-8 min-w-0 items-center gap-2 px-2">
      <ProjectIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span data-board-project-name="" className="min-w-0 truncate text-ui text-foreground">
        {projectName}
      </span>
      <span className="min-w-0 flex-1" />
      {door}
      {projectId !== null && isRepo && session.archivedAt == null ? (
        <NewBranchMountAction
          sessionId={sessionId}
          projectId={projectId}
          projectName={projectName}
        />
      ) : null}
      {hasMounts ? (
        <IconButton
          size="xs"
          variant="ghost"
          icon={Unlink}
          iconSize={ICON_SIZE.row}
          label={`${NAMES.unmount} ${projectName}`}
          tooltip={isUnmountBlocked ? UNMOUNT_BLOCKED_REASON : NAMES.unmount}
          aria-haspopup={isUnmountBlocked ? undefined : 'dialog'}
          disabled={isUnmountBlocked}
          data-unmount-project=""
          onClick={requestDetach}
        />
      ) : null}
    </div>
  );
};
