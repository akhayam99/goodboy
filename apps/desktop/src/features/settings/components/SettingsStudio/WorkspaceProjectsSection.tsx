import { useEffect } from 'react';
import { Star } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { ProjectLinkList } from '../../../../shared/components/ProjectLinkList';
import { GoodboyIgnoreCard } from '../../../workspace/components/GoodboyIgnoreCard';
import { GoodboyIgnoreField } from './GoodboyIgnoreField';
import { SentryLinkedBadge } from '../../../integrations/sentry/SentryLinkedBadge';
import { ProjectBaseBranchInput } from './ProjectBaseBranchInput';
import { Button, Eyebrow, Notice } from '@goodboy/ui';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useProjectGitStatuses } from '../../../workspace/hooks/useProjectGitStatuses';
import { LocateMovedProjects } from '../../../workspace/components/LocateMovedProjects';

type Props = {
  readonly workspaceId: WorkspaceId;
};

export const WorkspaceProjectsSection = ({ workspaceId }: Props) => {
  const hasProjects = useAppStore((state) =>
    state.projects.some((project) => project.workspaceId === workspaceId),
  );
  const hasSentry = useAppStore((state) =>
    (state.workspaceIntegrations[workspaceId] ?? []).some(
      (binding) => binding.provider === 'sentry',
    ),
  );
  const loadProjectSentryLinks = useAppStore((state) => state.loadProjectSentryLinks);
  const statuses = useProjectGitStatuses({ workspaceId });
  const missing = statuses.filter((entry) => entry.status?.state === 'missing');
  const phase = useAppStore((state) => state.projectRelocationPhase);
  const owner = useAppStore((state) => state.projectRelocationWorkspaceId);
  const findMovedProjects = useAppStore((state) => state.findMovedProjects);
  const chooseFolder = async (): Promise<void> => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string' || picked.length === 0) {
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
    <section aria-labelledby="workspace-projects" className="flex flex-col gap-2">
      {!isRelocationOpen && missing.length > 0 && (
        <Notice
          tone="warning"
          placement="inline"
          title={`${missing.length} ${missing.length === 1 ? 'project is' : 'projects are'} not where Goodboy left ${missing.length === 1 ? 'it' : 'them'}.`}
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
      <ProjectLinkList
        workspaceId={workspaceId}
        density="compact"
        heading={({ count }) => (
          <h2 id="workspace-projects" className="flex items-center gap-1.5">
            <Eyebrow label="Projects" />
            <span className="text-eyebrow tabular-nums text-foreground">{count}</span>
          </h2>
        )}
        emptyHint="No projects linked yet. Add a repository or a folder."
        rowAccessory={({ project }) => (
          <span className="flex items-center gap-2">
            <SentryLinkedBadge project={project} />
            {project.kind === 'repo' && <ProjectBaseBranchInput project={project} />}
            {project.kind === 'repo' && <GoodboyIgnoreField project={project} />}
          </span>
        )}
      />
      {hasProjects && (
        <p className="flex items-center gap-1.5 px-2 text-label text-faint-foreground">
          <Star size={ICON_SIZE.row} aria-hidden className="shrink-0" />
          Starred projects come first for agents and in project pickers. Descriptions go into every
          agent's project list.
        </p>
      )}
    </section>
  );
};
