import { useId, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Chip, cn, Divider, formatError, Input, SectionHeader, Tooltip } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { AlertTriangle, Folder, FolderGit2, FolderPlus, Layers, Plus, X } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { AppBreadcrumb } from '../../../../app/components/AppBreadcrumb';
import { buildBreadcrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { initRepo, validateGitRepo } from '../../../../shared/lib/repo';
import { useChildRepoDetection } from '../../../../shared/hooks/useChildRepoDetection';
import { useProjectAdoption } from '../../../../shared/hooks/useProjectAdoption';
import { DetectedRepoList } from '../../../../shared/components/DetectedRepoList';
import { ProjectAdoptionNotice } from '../../../../shared/components/ProjectAdoptionNotice';
import type { ProjectAttachConflict } from '../../../../store/slices/projects/addProject';
import { lastPathSegment } from './lastPathSegment';

export type WorkspaceLinkMode = 'project' | 'workspace';

type Props = {
  readonly onComplete: (params: {
    readonly mode: WorkspaceLinkMode;
    readonly workspace: Workspace;
  }) => void;
  readonly onCancel: () => void;
  readonly showBreadcrumb: boolean;
  readonly footerContainer?: HTMLElement | null;
};

const CHOICE_OPTIONS = [
  {
    value: 'project',
    icon: FolderGit2,
    label: 'Start from a project',
    hint: 'Point at one folder. Its git repository links directly, and a folder of repositories becomes a workspace named after it.',
  },
  {
    value: 'workspace',
    icon: Layers,
    label: 'A workspace with several projects',
    hint: 'Name it after your company or team, then add the projects it works on.',
  },
] as const;

export const WorkspaceLinkForm = ({
  onComplete,
  onCancel,
  showBreadcrumb,
  footerContainer,
}: Props) => {
  const formId = useId();
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const createWorkspace = useAppStore((state) => state.createWorkspace);
  const addProject = useAppStore((state) => state.addProject);
  const addProjects = useAppStore((state) => state.addProjects);
  const adoptProject = useAppStore((state) => state.adoptProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const setCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace);
  const projects = useAppStore((state) => state.projects);
  const { detected, detect, clear } = useChildRepoDetection();

  const [choice, setChoice] = useState<WorkspaceLinkMode | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [created, setCreated] = useState<Workspace | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const detectedPaths = useMemo(() => detected?.repos.map((repo) => repo.path) ?? [], [detected]);
  const adoption = useProjectAdoption({ workspaceId: created?.id ?? null, detectedPaths });

  const linked = useMemo(
    () =>
      created === null ? [] : projects.filter((project) => project.workspaceId === created.id),
    [projects, created],
  );

  const run = (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    void action()
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setBusy(false));
  };

  const createWorkspaceWithProjects = async ({
    name,
    rootPaths,
  }: {
    readonly name: string;
    readonly rootPaths: ReadonlyArray<string>;
  }) => {
    const workspace = await createWorkspace({ name });
    await setCurrentWorkspace(workspace.id);
    const result = await addProjects({ workspaceId: workspace.id, rootPaths });
    adoption.noteConflicts(result.conflicts);
    return workspace;
  };

  const handleLinkResult = (result: Awaited<ReturnType<typeof addProject>>) => {
    if (result.kind === 'conflict') {
      adoption.noteConflicts([result.conflict]);
    }
  };

  const completeWithWorkspace = async ({
    mode,
    workspace,
  }: {
    readonly mode: WorkspaceLinkMode;
    readonly workspace: Workspace;
  }) => {
    await setCurrentWorkspace(workspace.id);
    onComplete({ mode, workspace });
  };

  const pickDirectory = async (): Promise<string | null> => {
    const picked = await openDialog({ directory: true, multiple: false });
    return typeof picked === 'string' && picked.length > 0 ? picked : null;
  };

  const onPickProjectFolder = () =>
    run(async () => {
      const picked = await pickDirectory();
      if (picked === null) {
        return;
      }
      clear();
      const check = await validateGitRepo(picked);
      if (check.isRepo && check.rootPath != null && check.rootPath !== '') {
        const workspace = await addWorkspace({ rootPath: check.rootPath });
        await completeWithWorkspace({ mode: 'project', workspace });
        return;
      }
      if (await detect({ path: picked })) {
        return;
      }
      throw new Error(
        `no git repository at ${picked}. pick a folder with a .git directory, use New project to initialize one, or link it without git below`,
      );
    });

  const onNewProject = () =>
    run(async () => {
      const picked = await pickDirectory();
      if (picked === null) {
        return;
      }
      clear();
      const initialized = await initRepo({ path: picked });
      const workspace = await addWorkspace({ rootPath: initialized.rootPath });
      await completeWithWorkspace({ mode: 'project', workspace });
    });

  const onLinkPlainFolder = () =>
    run(async () => {
      const picked = await pickDirectory();
      if (picked === null) {
        return;
      }
      clear();
      if (created !== null) {
        handleLinkResult(
          await addProject({
            workspaceId: created.id,
            rootPath: picked,
            requireRepo: false,
          }),
        );
        return;
      }
      const workspace = await addWorkspace({ rootPath: picked });
      await completeWithWorkspace({ mode: 'project', workspace });
    });

  const linkProject = ({ rootPath }: { readonly rootPath: string }) =>
    run(async () => {
      if (created === null) {
        return;
      }
      clear();
      if (await detect({ path: rootPath })) {
        return;
      }
      handleLinkResult(await addProject({ workspaceId: created.id, rootPath }));
      setProjectPath('');
    });

  const onNewLinkedProject = () =>
    run(async () => {
      if (created === null) {
        return;
      }
      const picked = await pickDirectory();
      if (picked === null) {
        return;
      }
      clear();
      const initialized = await initRepo({ path: picked });
      handleLinkResult(
        await addProject({ workspaceId: created.id, rootPath: initialized.rootPath }),
      );
      setProjectPath('');
    });

  const onBrowseProject = () =>
    run(async () => {
      const picked = await pickDirectory();
      if (picked !== null) {
        setProjectPath(picked);
      }
    });

  const onConfirmDetected = ({ paths }: { readonly paths: ReadonlyArray<string> }) =>
    run(async () => {
      if (detected === null) {
        return;
      }
      const knownConflicts = paths.flatMap((entry) => {
        const conflict = adoption.knownConflicts[entry];
        return conflict === undefined ? [] : [conflict];
      });
      const freshPaths = paths.filter((entry) => adoption.knownConflicts[entry] === undefined);
      if (created === null) {
        const name = lastPathSegment({ path: detected.parentPath });
        const workspace = await createWorkspaceWithProjects({ name, rootPaths: freshPaths });
        for (const conflict of knownConflicts) {
          await adoptProject({ projectId: conflict.project.id, targetWorkspaceId: workspace.id });
        }
        clear();
        setWorkspaceName(workspace.name);
        setCreated(workspace);
        return;
      }
      const result = await addProjects({ workspaceId: created.id, rootPaths: freshPaths });
      for (const conflict of knownConflicts) {
        await adoption.adoptConflict(conflict);
      }
      adoption.noteConflicts(result.conflicts);
      clear();
      setProjectPath('');
    });

  const onMoveConflict = (conflict: ProjectAttachConflict) =>
    run(async () => {
      await adoption.adoptConflict(conflict);
    });

  const onCreateWorkspace = () =>
    run(async () => {
      const workspace = await createWorkspace({ name: workspaceName.trim() });
      await setCurrentWorkspace(workspace.id);
      setCreated(workspace);
    });

  const onDone = () => {
    if (created !== null) {
      onComplete({ mode: 'workspace', workspace: created });
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (created !== null) {
      onDone();
      return;
    }
    if (choice === 'workspace') {
      onCreateWorkspace();
    }
  };

  const breadcrumbCrumbs = buildBreadcrumb({
    workspace: null,
    session: null,
    chrome: { kind: 'workspace-create' },
    handlers: {
      toOverview: onCancel,
      toWorkspaceLauncher: () => {
        onCancel();
        window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
      },
      toWorkspaceBoard: onCancel,
    },
  });

  const primary =
    created !== null
      ? { label: 'Done', disabled: busy || linked.length === 0 }
      : choice === 'workspace'
        ? {
            label: busy ? 'Creating workspace…' : 'Create workspace',
            disabled: busy || workspaceName.trim().length === 0,
          }
        : null;

  const actions = (
    <>
      {error != null ? (
        <span role="alert" className="flex min-w-0 flex-1 items-center gap-1 text-xs text-danger">
          <AlertTriangle size={12} aria-hidden className="shrink-0" />
          {error}
        </span>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden />
      )}
      {created === null ? (
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      ) : null}
      {primary !== null ? (
        <Button type="submit" form={formId} disabled={primary.disabled} aria-busy={busy}>
          {primary.label}
        </Button>
      ) : null}
    </>
  );

  return (
    <form id={formId} onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {showBreadcrumb ? <AppBreadcrumb crumbs={breadcrumbCrumbs} /> : null}

      {created === null ? (
        <section className="flex flex-col gap-4">
          <SectionHeader
            icon={<FolderGit2 size={12} aria-hidden />}
            label="Workspace details"
            hint="A workspace groups the projects, sessions, and connections of one product or team."
          />
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Setup shape">
            {CHOICE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={choice === option.value}
                disabled={busy}
                onClick={() => {
                  setChoice(option.value);
                  setError(null);
                  clear();
                }}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-3 text-left motion-safe:transition-colors',
                  choice === option.value
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-primary/5',
                )}
              >
                <span className="mt-0.5 shrink-0 text-primary">
                  <option.icon size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{option.label}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {choice === 'project' ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  disabled={busy}
                  onClick={onPickProjectFolder}
                >
                  <FolderGit2 size={14} aria-hidden />
                  Choose a folder
                </Button>
                <Button type="button" variant="secondary" disabled={busy} onClick={onNewProject}>
                  <FolderPlus size={14} aria-hidden />
                  New project
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pick a folder with a git repository, or let New project run git init in an empty
                one.
              </p>
              {detected !== null ? (
                <DetectedRepoList
                  repos={detected.repos}
                  busy={busy}
                  known={adoption.knownRepos}
                  onConfirm={onConfirmDetected}
                  onDismiss={clear}
                />
              ) : null}
              <button
                type="button"
                onClick={onLinkPlainFolder}
                disabled={busy}
                className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Link a plain folder (no git)
              </button>
            </div>
          ) : null}

          {choice === 'workspace' ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${formId}-workspace-name`}
                className="text-xs font-medium text-foreground"
              >
                Workspace name
              </label>
              <Input
                id={`${formId}-workspace-name`}
                value={workspaceName}
                autoFocus
                placeholder="Your company or team name"
                disabled={busy}
                onChange={(event) => setWorkspaceName(event.target.value)}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <SectionHeader
            icon={<FolderGit2 size={12} aria-hidden />}
            label="Projects"
            hint={`Add the repositories ${created.name} works on.`}
          />

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
              value={projectPath}
              placeholder="/path/to/repository"
              disabled={busy}
              onChange={(event) => setProjectPath(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && projectPath.trim().length > 0) {
                  event.preventDefault();
                  linkProject({ rootPath: projectPath.trim() });
                }
              }}
            />
            <Button type="button" variant="secondary" onClick={onBrowseProject} disabled={busy}>
              Browse
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => linkProject({ rootPath: projectPath.trim() })}
              disabled={busy || projectPath.trim().length === 0}
            >
              <Plus size={14} aria-hidden /> Add
            </Button>
            <Button type="button" variant="secondary" onClick={onNewLinkedProject} disabled={busy}>
              <FolderPlus size={14} aria-hidden /> New project
            </Button>
          </div>

          {detected !== null ? (
            <DetectedRepoList
              repos={detected.repos}
              busy={busy}
              known={adoption.knownRepos}
              onConfirm={onConfirmDetected}
              onDismiss={clear}
            />
          ) : null}

          {adoption.conflicts.map((conflict) => (
            <ProjectAdoptionNotice
              key={conflict.project.id}
              conflict={conflict}
              busy={busy}
              onMove={onMoveConflict}
              onKeep={(entry) => adoption.dismissConflict(entry.project.id)}
            />
          ))}

          <button
            type="button"
            onClick={onLinkPlainFolder}
            disabled={busy}
            className="self-start text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Link a plain folder (no git)
          </button>
        </section>
      )}

      {footerContainer == null ? (
        <>
          <Divider />
          <footer className="flex items-center justify-end gap-2">{actions}</footer>
        </>
      ) : (
        createPortal(actions, footerContainer)
      )}
    </form>
  );
};
