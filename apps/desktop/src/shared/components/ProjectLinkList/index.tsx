import type { ReactNode } from 'react';
import type { Project, WorkspaceId } from '@goodboy/types';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { useProjectLinking } from '../../hooks/useProjectLinking';
import { DetectedRepoList } from '../DetectedRepoList';
import { ProjectAdoptionNotice } from '../ProjectAdoptionNotice';
import { ProjectAddPopover } from './ProjectAddPopover';
import { ProjectLinkAddRow } from './ProjectLinkAddRow';
import { ProjectLinkRow } from './ProjectLinkRow';
import type { ProjectLinkDensity } from './projectLinkDensity';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialConflicts?: ReadonlyArray<ProjectAttachConflict>;
  readonly emptyHint?: string;
  readonly rowAccessory?: (params: { readonly project: Project }) => ReactNode;
  readonly density?: ProjectLinkDensity;
  readonly heading?: (params: { readonly count: number }) => ReactNode;
};

export const ProjectLinkList = ({
  workspaceId,
  initialConflicts,
  emptyHint,
  rowAccessory,
  density = 'comfortable',
  heading,
}: Props) => {
  const linking = useProjectLinking({ workspaceId, initialConflicts });
  const isCompact = density === 'compact';

  return (
    <div className="flex flex-col gap-2">
      {isCompact && (
        <div className="flex min-w-0 items-center gap-2">
          {heading?.({ count: linking.linked.length })}
          <span className="flex-1" />
          <ProjectAddPopover
            path={linking.path}
            busy={linking.busy}
            onPathChange={linking.setPath}
            onAdd={({ rootPath }) => void linking.link({ rootPath })}
            onBrowse={() => void linking.browse()}
            onNewProject={() => void linking.newProject()}
            onLinkPlainFolder={() => void linking.linkPlainFolder()}
          />
        </div>
      )}
      {linking.linked.length === 0 && emptyHint !== undefined && (
        <p className="text-body text-muted-foreground">{emptyHint}</p>
      )}
      {linking.linked.length > 0 && (
        <ul className={isCompact ? 'flex flex-col' : 'flex flex-col gap-2'}>
          {linking.linked.map((project) => (
            <ProjectLinkRow
              key={project.id}
              project={project}
              busy={linking.busy}
              density={density}
              accessory={rowAccessory?.({ project })}
              onUnlink={linking.unlink}
            />
          ))}
        </ul>
      )}

      {!isCompact && (
        <ProjectLinkAddRow
          path={linking.path}
          busy={linking.busy}
          onPathChange={linking.setPath}
          onAdd={({ rootPath }) => void linking.link({ rootPath })}
          onBrowse={() => void linking.browse()}
          onNewProject={() => void linking.newProject()}
        />
      )}

      {linking.detected !== null && (
        <DetectedRepoList
          repos={linking.detected.repos}
          busy={linking.busy}
          known={linking.knownRepos}
          onConfirm={({ paths }) => void linking.linkDetected({ paths })}
          onDismiss={linking.dismissDetection}
        />
      )}

      {linking.conflicts.map((conflict) => (
        <ProjectAdoptionNotice
          key={conflict.project.id}
          conflict={conflict}
          busy={linking.busy}
          onMove={(entry) => void linking.moveConflict({ conflict: entry })}
          onKeep={(entry) => linking.keepConflict({ conflict: entry })}
        />
      ))}

      {!isCompact && (
        <button
          type="button"
          onClick={() => void linking.linkPlainFolder()}
          disabled={linking.busy}
          className="self-start text-label font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Link a plain folder (no git)
        </button>
      )}

      {linking.error !== null && (
        <p role="alert" className="text-label text-danger">
          {linking.error}
        </p>
      )}
    </div>
  );
};
