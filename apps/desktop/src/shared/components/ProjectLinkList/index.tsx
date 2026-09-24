import type { ReactNode } from 'react';
import type { Project, WorkspaceId } from '@goodboy/types';
import type { ProjectAttachConflict } from '../../../store/slices/projects/addProject';
import { useProjectLinking } from '../../hooks/useProjectLinking';
import { DetectedRepoList } from '../DetectedRepoList';
import { ProjectAdoptionNotice } from '../ProjectAdoptionNotice';
import { ProjectLinkAddRow } from './ProjectLinkAddRow';
import { ProjectLinkRow } from './ProjectLinkRow';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly initialConflicts?: ReadonlyArray<ProjectAttachConflict>;
  readonly emptyHint?: string;
  readonly rowAccessory?: (params: { readonly project: Project }) => ReactNode;
};

export const ProjectLinkList = ({
  workspaceId,
  initialConflicts,
  emptyHint,
  rowAccessory,
}: Props) => {
  const linking = useProjectLinking({ workspaceId, initialConflicts });

  return (
    <div className="flex flex-col gap-2">
      {linking.linked.length === 0 && emptyHint !== undefined && (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      )}
      {linking.linked.length > 0 && (
        <ul className="flex flex-col gap-2">
          {linking.linked.map((project) => (
            <ProjectLinkRow
              key={project.id}
              project={project}
              busy={linking.busy}
              accessory={rowAccessory?.({ project })}
              onUnlink={linking.unlink}
            />
          ))}
        </ul>
      )}

      <ProjectLinkAddRow
        path={linking.path}
        busy={linking.busy}
        onPathChange={linking.setPath}
        onAdd={({ rootPath }) => void linking.link({ rootPath })}
        onBrowse={() => void linking.browse()}
        onNewProject={() => void linking.newProject()}
      />

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

      <button
        type="button"
        onClick={() => void linking.linkPlainFolder()}
        disabled={linking.busy}
        className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Link a plain folder (no git)
      </button>

      {linking.error !== null && (
        <p role="alert" className="text-xs text-danger">
          {linking.error}
        </p>
      )}
    </div>
  );
};
