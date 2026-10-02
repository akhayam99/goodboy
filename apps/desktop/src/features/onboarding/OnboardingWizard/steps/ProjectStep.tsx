import { useState } from 'react';
import { FolderOpen, FolderPlus, Plus } from 'lucide-react';
import { Button, Input } from '@goodboy/ui';
import type { Project, ProjectId } from '@goodboy/types';
import type { DetectedChildRepos } from '../../../../shared/hooks/useChildRepoDetection';
import { usePickFolder } from '../../../../shared/hooks/usePickFolder';
import { DetectedRepoList, type KnownRepo } from '../../../../shared/components/DetectedRepoList';
import { ProjectAdoptionNotice } from '../../../../shared/components/ProjectAdoptionNotice';
import type { ProjectAttachConflict } from '../../../../store/slices/projects/addProject';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { NewProjectForm } from '../../../../shared/components/NewProjectForm';
import { FolderCard } from './FolderCard';
import { StepHeading } from './StepHeading';

export type FolderPick = {
  readonly path: string;
  readonly replaces: ProjectId | null;
};

type Props = {
  readonly projects: ReadonlyArray<Project>;
  readonly name: string;
  readonly onNameChange: (name: string) => void;
  readonly busy: boolean;
  readonly onPickFolder: (pick: FolderPick) => void;
  readonly detection: DetectedChildRepos | null;
  readonly knownRepos: Readonly<Record<string, KnownRepo>>;
  readonly conflict: ProjectAttachConflict | null;
  readonly onMoveConflict: () => void;
  readonly onKeepConflict: () => void;
  readonly onConfirmDetection: (params: { readonly paths: ReadonlyArray<string> }) => void;
  readonly onDismissDetection: () => void;
  readonly onNewProjectCreated: () => void;
};

export const ProjectStep = ({
  projects,
  name,
  onNameChange,
  busy,
  onPickFolder,
  detection,
  knownRepos,
  conflict,
  onMoveConflict,
  onKeepConflict,
  onConfirmDetection,
  onDismissDetection,
  onNewProjectCreated,
}: Props) => {
  const pickFolder = usePickFolder();
  const [isStarting, setIsStarting] = useState(false);
  const pick = async (replaces: ProjectId | null) => {
    const path = await pickFolder();
    if (path !== null) {
      onPickFolder({ path, replaces });
    }
  };
  const hasProjects = projects.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title="Pick a project"
        line="A folder with code, or any folder with documents."
      />
      {hasProjects ? (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <FolderCard
              key={project.id}
              project={project}
              busy={busy}
              onChange={() => void pick(project.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void pick(null)}>
              <FolderOpen size={ICON_SIZE.control} aria-hidden />
              Choose a folder
            </Button>
            <Button
              variant="secondary"
              disabled={busy || isStarting}
              onClick={() => setIsStarting(true)}
            >
              <FolderPlus size={ICON_SIZE.control} aria-hidden />
              Start a new project
            </Button>
          </div>
          {isStarting ? (
            <NewProjectForm onCreated={onNewProjectCreated} onCancel={() => setIsStarting(false)} />
          ) : null}
        </div>
      )}
      {detection !== null ? (
        <DetectedRepoList
          repos={detection.repos}
          busy={busy}
          known={knownRepos}
          onConfirm={onConfirmDetection}
          onDismiss={onDismissDetection}
        />
      ) : null}
      {conflict !== null ? (
        <ProjectAdoptionNotice
          conflict={conflict}
          busy={busy}
          onMove={onMoveConflict}
          onKeep={onKeepConflict}
        />
      ) : null}
      {hasProjects && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="onboarding-workspace-name" className="text-label text-foreground">
              Workspace name
            </label>
            <Input
              id="onboarding-workspace-name"
              value={name}
              disabled={busy}
              placeholder="Your company or team name"
              onChange={(event) => onNameChange(event.target.value)}
            />
            <p className="text-secondary text-muted-foreground">
              A workspace groups projects that ship together. We named it after the parent folder.
            </p>
          </div>
          <div>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void pick(null)}>
              <Plus size={ICON_SIZE.control} aria-hidden />
              Add another project
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
