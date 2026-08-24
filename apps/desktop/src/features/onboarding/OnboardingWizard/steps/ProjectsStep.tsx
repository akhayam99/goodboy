import { useMemo, useState } from 'react';
import { Folder, FolderGit2, FolderPlus, Plus, X } from 'lucide-react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Chip, Input, Tooltip, formatError } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { initRepo } from '../../../../shared/lib/repo';
import { useChildRepoDetection } from '../../../../shared/hooks/useChildRepoDetection';
import { useProjectAdoption } from '../../../../shared/hooks/useProjectAdoption';
import { DetectedRepoList } from '../../../../shared/components/DetectedRepoList';
import { ProjectAdoptionNotice } from '../../../../shared/components/ProjectAdoptionNotice';
import type { ProjectAttachConflict } from '../../../../store/slices/projects/addProject';

type Props = {
  readonly workspace: Workspace;
  readonly initialConflicts?: ReadonlyArray<ProjectAttachConflict>;
};

export const ProjectsStep = ({ workspace, initialConflicts }: Props) => {
  const projects = useAppStore((state) => state.projects);
  const addProject = useAppStore((state) => state.addProject);
  const addProjects = useAppStore((state) => state.addProjects);
  const removeProject = useAppStore((state) => state.removeProject);
  const { detected, detect, clear } = useChildRepoDetection();
  const [path, setPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detectedPaths = useMemo(() => detected?.repos.map((repo) => repo.path) ?? [], [detected]);
  const adoption = useProjectAdoption({
    workspaceId: workspace.id,
    detectedPaths,
    initialConflicts,
  });

  const linked = useMemo(
    () => projects.filter((project) => project.workspaceId === workspace.id),
    [projects, workspace.id],
  );

  const link = async ({
    rootPath,
    requireRepo = true,
  }: {
    readonly rootPath: string;
    readonly requireRepo?: boolean;
  }) => {
    setBusy(true);
    setError(null);
    clear();
    try {
      if (requireRepo && (await detect({ path: rootPath }))) {
        return;
      }
      const result = await addProject({ workspaceId: workspace.id, rootPath, requireRepo });
      setPath('');
      if (result.kind === 'conflict') {
        adoption.noteConflicts([result.conflict]);
      }
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
      const knownConflicts = paths.flatMap((entry) => {
        const conflict = adoption.knownConflicts[entry];
        return conflict === undefined ? [] : [conflict];
      });
      const freshPaths = paths.filter((entry) => adoption.knownConflicts[entry] === undefined);
      const result = await addProjects({ workspaceId: workspace.id, rootPaths: freshPaths });
      for (const conflict of knownConflicts) {
        await adoption.adoptConflict(conflict);
      }
      adoption.noteConflicts(result.conflicts);
      clear();
      setPath('');
    } catch (linkError) {
      setError(formatError(linkError));
    } finally {
      setBusy(false);
    }
  };

  const moveConflict = async (conflict: ProjectAttachConflict) => {
    setBusy(true);
    setError(null);
    try {
      await adoption.adoptConflict(conflict);
    } catch (moveError) {
      setError(formatError(moveError));
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
      await link({ rootPath: initialized.rootPath });
    } catch (createError) {
      setError(formatError(createError));
      setBusy(false);
    }
  };

  const onLinkPlainFolder = async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string' || picked.length === 0) {
      return;
    }
    await link({ rootPath: picked, requireRepo: false });
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
          Add the repositories {workspace.name} works on.
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
            placeholder="/path/to/repository"
            disabled={busy}
            onChange={(event) => setPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && path.trim().length > 0) {
                event.preventDefault();
                void link({ rootPath: path.trim() });
              }
            }}
          />
          <Button variant="secondary" onClick={() => void onBrowse()} disabled={busy}>
            Browse
          </Button>
          <Button
            variant="primary"
            onClick={() => void link({ rootPath: path.trim() })}
            disabled={busy || path.trim().length === 0}
          >
            <Plus size={14} aria-hidden /> Add
          </Button>
          <Button variant="secondary" onClick={() => void onNewProject()} disabled={busy}>
            <FolderPlus size={14} aria-hidden /> New project
          </Button>
        </div>

        {detected !== null ? (
          <DetectedRepoList
            repos={detected.repos}
            busy={busy}
            known={adoption.knownRepos}
            onConfirm={({ paths }) => void linkDetected({ paths })}
            onDismiss={clear}
          />
        ) : null}

        {adoption.conflicts.map((conflict) => (
          <ProjectAdoptionNotice
            key={conflict.project.id}
            conflict={conflict}
            busy={busy}
            onMove={(entry) => void moveConflict(entry)}
            onKeep={(entry) => adoption.dismissConflict(entry.project.id)}
          />
        ))}

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
    </div>
  );
};
