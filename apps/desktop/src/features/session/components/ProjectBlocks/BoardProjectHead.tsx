import type { ReactNode } from 'react';
import { Unlink } from '@goodboy/ui/icons';
import { ICON_SIZE, IconButton } from '@goodboy/ui';
import type { ProjectId } from '@goodboy/types';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { NAMES } from '../../../../shared/utils/names';
import { useAppStore } from '../../../../store';
import {
  PROJECT_DETACH_EVENT,
  projectKeyOf,
  type ProjectDetachRequest,
} from '../../../actions/kinds/project';
import { sessionProjectIdsOf } from './sessionProjectIdsOf';
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
  const requestDetach = () => {
    if (projectId === null) {
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
      {hasMounts ? (
        <IconButton
          size="xs"
          variant="ghost"
          icon={Unlink}
          iconSize={ICON_SIZE.row}
          label={`${NAMES.unmount} ${projectName}`}
          tooltip={NAMES.unmount}
          aria-haspopup="dialog"
          onClick={requestDetach}
        />
      ) : null}
    </div>
  );
};
