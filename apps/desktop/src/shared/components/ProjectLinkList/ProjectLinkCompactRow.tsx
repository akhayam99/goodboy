import { useState, type ReactNode } from 'react';
import { TriangleAlert, Folder, FolderGit2 } from 'lucide-react';
import type { Project, WorkspaceGitStatus } from '@goodboy/types';
import { cn, ICON_SIZE, ROW_INTERACTIVE, Tooltip } from '@goodboy/ui';

import { ProjectRowEditor } from './ProjectRowEditor';
import { PROJECT_ROW_GRID } from './projectRowGrid';
import { ProjectStarToggle } from './ProjectStarToggle';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly status: WorkspaceGitStatus | null;
  readonly editorExtra?: ReactNode;
  readonly badge?: ReactNode;
  readonly scripts?: ReactNode;
  readonly onUnlink: (params: { readonly project: Project }) => Promise<void>;
};

export const ProjectLinkCompactRow = ({
  project,
  busy,
  status,
  editorExtra,
  badge,
  scripts,
  onUnlink,
}: Props) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const isRepo = project.kind === 'repo';
  const KindIcon = isRepo ? FolderGit2 : Folder;
  const isFolderMissing = status?.state === 'missing';
  const description = project.description ?? '';

  const toggleEditor = () => setIsEditorOpen((open) => !open);

  return (
    <li className={cn('col-span-full grid grid-cols-subgrid gap-y-1', PROJECT_ROW_GRID)}>
      <div
        onClick={toggleEditor}
        className={cn(
          'group col-span-full grid h-8 min-w-0 grid-cols-subgrid items-center rounded-md text-left',
          ROW_INTERACTIVE,
        )}
      >
        <div className="col-start-2 flex">
          <ProjectStarToggle project={project} busy={busy} />
        </div>
        <KindIcon
          size={ICON_SIZE.row}
          role="img"
          aria-label={isRepo ? 'Repository' : 'Folder'}
          className="shrink-0 text-muted-foreground"
        />
        <Tooltip content={project.rootPath} anchorClassName="flex min-w-0">
          <button
            type="button"
            aria-expanded={isEditorOpen}
            aria-label={`Edit ${project.name}`}
            onClick={(event) => {
              event.stopPropagation();
              toggleEditor();
            }}
            className="truncate rounded-sm text-row text-foreground hover:underline"
          >
            {project.name}
          </button>
        </Tooltip>
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-meta text-muted-foreground">
            {description !== '' ? (
              description
            ) : (
              <span className="text-faint-foreground opacity-0 group-hover:opacity-100">
                Add a description
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {badge}
          {project.baseBranch != null && project.baseBranch !== '' ? (
            <span className="shrink-0 rounded-sm bg-muted px-2 py-0.5 text-code text-muted-foreground">
              {project.baseBranch}
            </span>
          ) : null}
        </span>
        {isFolderMissing ? (
          <span className="flex shrink-0 items-center gap-1 text-meta text-warning">
            <TriangleAlert size={ICON_SIZE.control} aria-hidden />
            Folder not found
          </span>
        ) : (
          <span />
        )}
        <span />
      </div>
      {isEditorOpen ? (
        <div className="col-span-6 col-start-4">
          <ProjectRowEditor
            project={project}
            busy={busy}
            onUnlink={() => void onUnlink({ project })}
            ignoreField={editorExtra}
            scriptsField={scripts}
          />
        </div>
      ) : null}
    </li>
  );
};
