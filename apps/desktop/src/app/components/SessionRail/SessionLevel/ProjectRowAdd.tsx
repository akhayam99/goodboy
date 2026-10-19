import { useMemo } from 'react';
import type { ProjectId, SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useActionEnv } from '../../../../features/actions/useActionEnv';
import { useObjectActions } from '../../../../features/actions/useObjectActions';
import type { ObjectTarget } from '../../../../features/actions/types';
import { NewBranchMountAction } from '../../../../features/session/components/SessionOverviewPane/ProjectMountRows/NewBranchMountAction';
import { projectNewBranchEventOf } from '../../../../features/actions/kinds/project';
import { LEVEL_ADD_SIZE } from '../../../../shared/components/levelAddSize';

type Props = {
  readonly sessionId: SessionId;
  readonly projectId: ProjectId;
  readonly projectName: string;
};

const NEW_BRANCH_ACTION = 'project.newBranch';

const QUIET_TRIGGER =
  'shrink-0 text-faint-foreground group-hover/project-row:text-foreground group-focus-within/project-row:text-foreground';

export const ProjectRowAdd = ({ sessionId, projectId, projectName }: Props) => {
  const env = useActionEnv({ origin: 'button' });
  const target = useMemo<ObjectTarget>(
    () => ({ kind: 'project', sessionId, projectId }),
    [sessionId, projectId],
  );
  const { actions } = useObjectActions({ target, env });
  const isOffered = actions.some((action) => action.id === NEW_BRANCH_ACTION);
  if (!isOffered) {
    return <span aria-hidden data-project-row-slot="" className={cn('shrink-0', LEVEL_ADD_SIZE)} />;
  }
  return (
    <NewBranchMountAction
      sessionId={sessionId}
      projectId={projectId}
      projectName={projectName}
      presentation="add"
      triggerClassName={QUIET_TRIGGER}
      openEvent={projectNewBranchEventOf({ sessionId, projectId })}
    />
  );
};
