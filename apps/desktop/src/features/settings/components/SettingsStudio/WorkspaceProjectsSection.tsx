import { useMemo, useState } from 'react';
import { Folder, FolderGit2, FolderPlus, Plus, X } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import type { WorkspaceId } from '@goodboy/types';
import { Button, Chip, SectionHeader, Tooltip, cn, formatError } from '@goodboy/ui';
import { useAppStore } from '../../../../store';
import { initRepo } from '../../../../shared/lib/repo';
import { useChildRepoDetection } from '../../../../shared/hooks/useChildRepoDetection';
import { DetectedRepoList } from '../../../../shared/components/DetectedRepoList';
import { useToast } from '../../../../app/components/Toast';

type Props = {
  readonly workspaceId: WorkspaceId;
};

const EMPTY_PROJECTS: ReadonlyArray<never> = [];

export const WorkspaceProjectsSection = ({ workspaceId }: Props) => {
  const projects = useAppStore((s) => s.projects ?? EMPTY_PROJECTS);
  const addProject = useAppStore((s) => s.addProject);
  const addProjects = useAppStore((s) => s.addProjects);
  const removeProject = useAppStore((s) => s.removeProject);
  const { detected, detect, clear } = useChildRepoDetection();
  const { showToast } = useToast();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = useMemo(
    () => projects.filter((project) => project.workspaceId === workspaceId),
    [projects, workspaceId],
  );

  const link = async (rootPath: string, requireRepo = true) => {
    setBusy(true);
    setError(null);
    clear();
    try {
      if (requireRepo && (await detect({ path: rootPath }))) {
        return;
      }
      const project = await addProject({ workspaceId, rootPath, requireRepo });
      setPath('');
      showToast('success', `linked ${project.name}`);
    } catch (linkError) {
      setError(formatError(linkError));
    } finally {
      setBusy(false);
    }
  };

  const linkDetected = async ({ paths }: { readonly paths: ReadonlyArray<string> }) => {
    setBusy(true);
    setError(null);
    try {
      const linkedProjects = await addProjects({ workspaceId, rootPaths: paths });
      clear();
      setPath('');
      showToast(
        'success',
        linkedProjects.length === 1
          ? `linked ${linkedProjects[0]?.name ?? '1 project'}`
          : `linked ${linkedProjects.length} projects`,
      );
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

  const onNewProject = async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string' || picked.length === 0) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const initialized = await initRepo({ path: picked });
      await link(initialized.rootPath);
    } catch (initError) {
      setError(formatError(initError));
      setBusy(false);
    }
  };

  const onLinkPlainFolder = async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string' || picked.length === 0) {
      return;
    }
    await link(picked, false);
  };

  const onUnlink = async (projectId: (typeof linked)[number]['id'], name: string) => {
    setBusy(true);
    try {
      await removeProject({ projectId });
      showToast('success', `disconnected ${name}`);
    } catch (unlinkError) {
      showToast('error', formatError(unlinkError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="projects" className="flex flex-col gap-4">
      <SectionHeader
        label="Projects"
        hint="The repositories and folders this workspace works on."
      />
      <div className="flex flex-col gap-2">
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects linked yet. Add a repository below.
          </p>
        ) : (
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
                <Tooltip content={`Disconnect ${project.name}`} anchorClassName="shrink-0">
                  <button
                    type="button"
                    aria-label={`Disconnect ${project.name}`}
                    disabled={busy}
                    onClick={() => void onUnlink(project.id, project.name)}
                    className="rounded-md p-1 text-muted-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                  >
                    <X size={14} aria-hidden />
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={path}
            aria-label="Project path"
            placeholder="/path/to/repository"
            disabled={busy}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && path.trim().length > 0) {
                event.preventDefault();
                void link(path.trim());
              }
            }}
            className={cn(
              'h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground motion-safe:transition-colors',
              'placeholder:text-muted-foreground/40',
              'hover:border-border-strong focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          />
          <Button variant="secondary" size="sm" onClick={() => void onBrowse()} disabled={busy}>
            Browse
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => void link(path.trim())}
            disabled={busy || path.trim().length === 0}
          >
            <Plus size={13} aria-hidden /> Add
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void onNewProject()} disabled={busy}>
            <FolderPlus size={13} aria-hidden /> New project
          </Button>
        </div>
        {detected !== null ? (
          <DetectedRepoList
            repos={detected.repos}
            busy={busy}
            onConfirm={({ paths }) => void linkDetected({ paths })}
            onDismiss={clear}
          />
        ) : null}
        <button
          type="button"
          onClick={() => void onLinkPlainFolder()}
          disabled={busy}
          className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Link a plain folder (no git)
        </button>
        {error !== null ? (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
};
