import { useState, type ReactNode } from 'react';
import { AlertTriangle, Folder, FolderGit2 } from 'lucide-react';
import type { Project, WorkspaceGitStatus } from '@goodboy/types';
import { InlineConfirm, Tooltip } from '@goodboy/ui';
import { ICON_SIZE } from '../conceptIcons';
import { ProjectRowActions } from './ProjectRowActions';
import { ProjectRowEditor } from './ProjectRowEditor';
import { ProjectStarToggle } from './ProjectStarToggle';

type Props = {
  readonly project: Project;
  readonly busy: boolean;
  readonly status: WorkspaceGitStatus | null;
  readonly editorExtra?: ReactNode;
  readonly badge?: ReactNode;
  readonly onUnlink: (params: { readonly project: Project }) => Promise<void>;
};

export const ProjectLinkCompactRow = ({
  project,
  busy,
  status,
  editorExtra,
  badge,
  onUnlink,
}: Props) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isConfirming, setConfirming] = useState(false);
  const isRepo = project.kind === 'repo';
  const KindIcon = isRepo ? FolderGit2 : Folder;
  const isFolderMissing = status?.state === 'missing';
  const description = project.description ?? '';

  const toggleEditor = () => setIsEditorOpen((open) => !open);

  return (
    <li className="flex flex-col gap-1">
      <div
        onClick={toggleEditor}
        className="group grid h-8 w-full min-w-0 cursor-pointer grid-cols-[16px_16px_180px_minmax(0,1fr)_auto_auto_88px] items-center gap-2 rounded-md px-2 text-left hover:bg-hover"
      >
        <ProjectStarToggle project={project} busy={busy} />
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
        <span className="flex min-w-0 items-center gap-1.5">
          {badge}
          <span className="min-w-0 truncate text-label text-muted-foreground">
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
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-code text-muted-foreground">
              {project.baseBranch}
            </span>
          ) : null}
        </span>
        {isFolderMissing ? (
          <span className="flex shrink-0 items-center gap-1 text-label text-warning">
            <AlertTriangle size={ICON_SIZE.control} aria-hidden />
            Folder not found
          </span>
        ) : (
          <span />
        )}
        <ProjectRowActions project={project} busy={busy} onArmUnlink={() => setConfirming(true)} />
      </div>
      {isEditorOpen ? (
        <ProjectRowEditor
          project={project}
          busy={busy}
          onArmUnlink={() => setConfirming(true)}
          ignoreField={editorExtra}
        />
      ) : null}
      {isConfirming ? (
        <InlineConfirm
          role="danger"
          icon={<AlertTriangle size={ICON_SIZE.row} aria-hidden />}
          title={`Unlink ${project.name}?`}
          description="The folder stays on disk. Its sessions keep their history. Link it again any time."
          confirmLabel="Unlink"
          isBusy={busy}
          onConfirm={async () => {
            await onUnlink({ project });
            setConfirming(false);
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
    </li>
  );
};
