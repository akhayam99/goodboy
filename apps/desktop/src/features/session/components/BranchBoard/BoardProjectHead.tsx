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
  readonly projectId: ProjectId;
  readonly projectName: string;
  readonly count: number | null;
};

export const BoardProjectHead = ({ projectId, projectName, count }: Props) => {
  const ProjectIcon = CONCEPT_ICONS.projectRepo;
  const { session } = useBoardContext();
  const sessionId = session.id;
  const hasMounts = useAppStore((state) =>
    sessionProjectIdsOf({ state, sessionId }).includes(projectId),
  );
  const requestDetach = () => {
    window.dispatchEvent(
      new CustomEvent<ProjectDetachRequest>(PROJECT_DETACH_EVENT, {
        detail: { projectKey: projectKeyOf({ sessionId, projectId }) },
      }),
    );
  };
  return (
    <div data-board-project-head="" className="flex h-7 min-w-0 items-center gap-2 px-2">
      <ProjectIcon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
      <span className="min-w-0 truncate text-meta text-muted-foreground">{projectName}</span>
      {count === null ? null : (
        <span className="shrink-0 text-meta tabular-nums text-faint-foreground">{count}</span>
      )}
      {hasMounts ? (
        <>
          <span className="min-w-0 flex-1" />
          <IconButton
            size="xs"
            variant="ghost"
            icon={Unlink}
            iconSize={ICON_SIZE.row}
            label={`Remove ${projectName} from session`}
            tooltip={NAMES.removeFromSession}
            aria-haspopup="dialog"
            onClick={requestDetach}
          />
        </>
      ) : null}
    </div>
  );
};
