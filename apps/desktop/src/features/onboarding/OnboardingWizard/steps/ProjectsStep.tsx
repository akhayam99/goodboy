import { useMemo, useState } from 'react';
import { Folder, FolderGit2, Plus, X } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Chip, Input, Tooltip, formatError } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { defaultSimpleWorkspacePath } from '../../../workspace/defaultSimpleWorkspacePath';
import { prepareSimpleWorkspace } from '../../../workspace/prepareSimpleWorkspace';

type Props = {
  readonly workspace: Workspace;
};

export const ProjectsStep = ({ workspace }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const addProject = useAppStore((state) => state.addProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const adoptWorkspaceSessionsRoot = useAppStore((state) => state.adoptWorkspaceSessionsRoot);
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = useMemo(
    () => projects.filter((project) => project.workspaceId === workspace.id),
    [projects, workspace.id],
  );

  const link = async (rootPath: string) => {
    setBusy(true);
    setError(null);
    try {
      const project = await addProject({ workspaceId: workspace.id, rootPath });
      await adoptWorkspaceSessionsRoot({ workspaceId: workspace.id, rootPath: project.rootPath });
      setPath('');
    } catch (linkError) {
      setError(formatError(linkError));
    } finally {
      setBusy(false);
    }
  };

  const onBrowse = async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string' && picked.length > 0) {
      setPath(picked);
    }
  };

  const onCreateFolder = async () => {
    setBusy(true);
    setError(null);
    try {
      const suggested = await defaultSimpleWorkspacePath({ name: workspace.name });
      const prepared = await prepareSimpleWorkspace({ path: suggested });
      await link(prepared);
    } catch (createError) {
      setError(formatError(createError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-lg border border-border-soft/40 bg-subtle/40 text-primary">
        <FolderGit2 size={26} aria-hidden />
      </span>

      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Link your projects
        </h2>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
          Add the repositories and folders {workspace.name} works on. Git repositories get branches
          and pull requests; plain folders work for notes, docs, and agent output.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3 text-left">
        {linked.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {linked.map((project) => (
              <li
                key={project.id}
                className="flex items-center gap-3 rounded-lg border border-border-soft/60 bg-subtle/20 px-3 py-2"
              >
                <span className="shrink-0 text-muted-foreground">
                  {project.kind === 'repo' ? (
                    <FolderGit2 size={16} aria-hidden />
                  ) : (
                    <Folder size={16} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {project.name}
                    </span>
                    <Chip
                      tone="neutral"
                      size="3xs"
                      bordered={false}
                      label={project.kind === 'repo' ? 'Repository' : 'Folder'}
                      className="shrink-0"
                    />
                  </span>
                  <span className="block truncate font-mono text-xs text-muted-foreground/80">
                    {project.rootPath}
                  </span>
                </span>
                <Tooltip content={`Unlink ${project.name}`} anchorClassName="shrink-0">
                  <button
                    type="button"
                    aria-label={`Unlink ${project.name}`}
                    disabled={busy}
                    onClick={() => void removeProject({ projectId: project.id })}
                    className="rounded-md p-1 text-muted-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex items-center gap-2">
          <Input
            aria-label="Project path"
            value={path}
            placeholder="/path/to/repo-or-folder"
            disabled={busy}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && path.trim().length > 0) {
                event.preventDefault();
                void link(path.trim());
              }
            }}
          />
          <Button variant="secondary" onClick={() => void onBrowse()} disabled={busy}>
            Browse
          </Button>
          <Button
            variant="primary"
            onClick={() => void link(path.trim())}
            disabled={busy || path.trim().length === 0}
          >
            <Plus size={14} aria-hidden /> Add
          </Button>
        </div>

        {linked.length === 0 ? (
          <button
            type="button"
            onClick={() => void onCreateFolder()}
            disabled={busy}
            className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            No repository? Create a fresh folder for this workspace
          </button>
        ) : null}

        {error !== null ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
};
