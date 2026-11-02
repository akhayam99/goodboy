import { useEffect } from 'react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { usePickFolder } from '../../../../shared/hooks/usePickFolder';
import { ProjectLinkList } from '../../../../shared/components/ProjectLinkList';
import { GoodboyIgnoreCard } from '../../../workspace/components/GoodboyIgnoreCard';
import { GoodboyIgnoreField } from './GoodboyIgnoreField';
import { SentryLinkedBadge } from '../../../integrations/sentry/SentryLinkedBadge';
import { Button, Notice } from '@goodboy/ui';
import { useProjectGitStatuses } from '../../../workspace/hooks/useProjectGitStatuses';
import { LocateMovedProjects } from '../../../workspace/components/LocateMovedProjects';
import { ProjectScriptsField } from '../../../scripts';
import { NewWorktreesField } from '../../../worktree/NewWorktreesField';
import { WorkspaceTerminalFolderRow } from './WorkspaceTerminalFolderRow';
import { PlainFolderOptions } from './PlainFolderOptions';
import { projectsCountLine } from './projectsCountLine';
import { FolderGitCard } from '../../../workspace/folderGitCard';
import { useFolderGitOpening } from '../../../workspace/folderGitOpening';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly isTrackWithGit?: boolean;
  readonly isFolderOptions?: boolean;
};

export const WorkspaceProjectsSection = ({
  workspaceId,
  isTrackWithGit = false,
  isFolderOptions = false,
}: Props) => {
  const hasProjects = useAppStore((state) =>
    state.projects.some((project) => project.workspaceId === workspaceId),
  );
  const hasSentry = useAppStore((state) =>
    (state.workspaceIntegrations[workspaceId] ?? []).some(
      (binding) => binding.provider === 'sentry',
    ),
  );
  const repoCount = useAppStore(
    (state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.kind === 'repo',
      ).length,
  );
  const folderCount = useAppStore(
    (state) =>
      state.projects.filter(
        (project) => project.workspaceId === workspaceId && project.kind === 'folder',
      ).length,
  );
  const { openId, noticeIds } = useFolderGitOpening({
    workspaceId,
    isOpeningFirst: isTrackWithGit || isFolderOptions,
  });
  const loadProjectSentryLinks = useAppStore((state) => state.loadProjectSentryLinks);
  const statuses = useProjectGitStatuses({ workspaceId });
  const missing = statuses.filter((entry) => entry.status?.state === 'missing');
  const phase = useAppStore((state) => state.projectRelocationPhase);
  const owner = useAppStore((state) => state.projectRelocationWorkspaceId);
  const findMovedProjects = useAppStore((state) => state.findMovedProjects);
  const pickFolder = usePickFolder();
  const chooseFolder = async (): Promise<void> => {
    const picked = await pickFolder();
    if (picked === null) {
      return;
    }
    await findMovedProjects({ workspaceId, parent: picked });
  };
  const isRelocationOpen = owner === workspaceId && phase !== 'idle';

  useEffect(() => {
    if (!hasSentry) {
      return;
    }
    void loadProjectSentryLinks({ workspaceId }).catch(() => undefined);
  }, [hasSentry, loadProjectSentryLinks, workspaceId]);

  return (
    <section aria-label="Workspace folders" className="flex flex-col gap-2">
      {!isRelocationOpen && missing.length > 0 && (
        <Notice
          tone="warning"
          placement="inline"
          title={`${missing.length} ${missing.length === 1 ? 'folder is' : 'folders are'} not where Goodboy left ${missing.length === 1 ? 'it' : 'them'}.`}
          body={`${missing.map((entry) => entry.project.name).join(', ')} ${missing.length === 1 ? 'was' : 'were'} at the saved folder. Sessions that use ${missing.length === 1 ? 'it are' : 'them are'} paused until you locate ${missing.length === 1 ? 'it' : 'them'}. Nothing was deleted.`}
          actions={
            <Button variant="secondary" size="sm" onClick={() => void chooseFolder()}>
              Locate folders
            </Button>
          }
        />
      )}
      <LocateMovedProjects workspaceId={workspaceId} onChoose={() => void chooseFolder()} />
      <GoodboyIgnoreCard workspaceId={workspaceId} />
      {hasProjects ? <WorkspaceTerminalFolderRow workspaceId={workspaceId} /> : null}
      <ProjectLinkList
        workspaceId={workspaceId}
        emptyHint="No folders yet"
        heading={() => (
          <h2 className="flex items-baseline gap-2 text-row text-foreground">
            Projects
            <span className="text-meta text-muted-foreground">
              {projectsCountLine({ repoCount, folderCount })}
            </span>
          </h2>
        )}
        isRowInitiallyOpen={({ project }) =>
          project.id === openId || noticeIds.includes(project.id)
        }
        editorExtra={({ project }) =>
          project.kind === 'repo' ? <GoodboyIgnoreField project={project} /> : null
        }
        rowBadge={({ project }) => <SentryLinkedBadge project={project} />}
        editorScripts={({ project }) => (
          <>
            {project.kind === 'folder' ? (
              <PlainFolderOptions
                folder={project}
                isGitInitiallyOpen={isTrackWithGit && project.id === openId}
              />
            ) : (
              <FolderGitCard projectId={project.id} isInitiallyOpen={false} isEmbedded />
            )}
            <ProjectScriptsField project={project} />
            {project.kind === 'repo' ? <NewWorktreesField project={project} /> : null}
          </>
        )}
      />
    </section>
  );
};
