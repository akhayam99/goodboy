import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  Button,
  Chip,
  cn,
  FormActions,
  formatError,
  Input,
  Notice,
  SectionHeader,
  Tooltip,
  tintClasses,
} from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { AlertTriangle, Folder, FolderGit2, FolderPlus, Layers, Plus, X } from 'lucide-react';
import { useAppStore } from '../../../../store';
import { initRepo, validateGitRepo } from '../../../../shared/lib/repo';
import { useChildRepoDetection } from '../../../../shared/hooks/useChildRepoDetection';
import { usePickFolder } from '../../../../shared/hooks/usePickFolder';
import { useProjectAdoption } from '../../../../shared/hooks/useProjectAdoption';
import { DetectedRepoList } from '../../../../shared/components/DetectedRepoList';
import { ProjectAdoptionNotice } from '../../../../shared/components/ProjectAdoptionNotice';
import type { ProjectAttachConflict } from '../../../../store/slices/projects/addProject';
import type { ReconnectCandidate } from '../../../../store/slices/workspaces/checkReconnectCandidate';
import { formatAge } from '../../../../shared/utils/time/formatAge';
import { lastPathSegment } from './lastPathSegment';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { useNow } from '../../../../shared/hooks/useNow';

export type WorkspaceLinkMode = 'project' | 'workspace';

type Props = {
  readonly onComplete: (params: {
    readonly mode: WorkspaceLinkMode;
    readonly workspace: Workspace;
  }) => void;
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

export const WorkspaceLinkForm = ({ onComplete }: Props) => {
  const now = useNow(30_000);
  const formId = useId();
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const checkReconnectCandidate = useAppStore((state) => state.checkReconnectCandidate);
  const reconnectMovedProject = useAppStore((state) => state.reconnectMovedProject);
  const createWorkspace = useAppStore((state) => state.createWorkspace);
  const addProject = useAppStore((state) => state.addProject);
  const addProjects = useAppStore((state) => state.addProjects);
  const adoptProject = useAppStore((state) => state.adoptProject);
  const removeProject = useAppStore((state) => state.removeProject);
  const openWorkspace = useAppStore((state) => state.openWorkspace);
  const projects = useAppStore((state) => state.projects);
  const { detected, detect, clear } = useChildRepoDetection();

  const [choice, setChoice] = useState<WorkspaceLinkMode | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [created, setCreated] = useState<Workspace | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectCandidate, setReconnectCandidate] = useState<{
    readonly rootPath: string;
    readonly candidate: ReconnectCandidate;
  } | null>(null);
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
    await openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' });
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
    await openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' });
    onComplete({ mode, workspace });
  };

  const pickDirectory = usePickFolder();

  const onPickProjectFolder = () =>
    run(async () => {
      const picked = await pickDirectory();
      if (picked === null) {
        return;
      }
      clear();
      setReconnectCandidate(null);
      const check = await validateGitRepo(picked);
      if (check.isRepo && check.rootPath != null && check.rootPath !== '') {
        if (await offerReconnect({ rootPath: check.rootPath })) {
          return;
        }
        const workspace = await addWorkspace({ rootPath: check.rootPath });
        await completeWithWorkspace({ mode: 'project', workspace });
        return;
      }
      if (await detect({ path: picked })) {
        return;
      }
      throw new Error(
        `No git repository at ${picked}. Pick a folder with a .git directory, use New project to initialize one, or use Link a plain folder.`,
      );
    });

  const onNewProject = () =>
    run(async () => {
      const picked = await pickDirectory();
      if (picked === null) {
        return;
      }
      clear();
      setReconnectCandidate(null);
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
      setReconnectCandidate(null);
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
      if (await offerReconnect({ rootPath: picked })) {
        return;
      }
      const workspace = await addWorkspace({ rootPath: picked });
      await completeWithWorkspace({ mode: 'project', workspace });
    });

  const offerReconnect = async ({ rootPath }: { readonly rootPath: string }): Promise<boolean> => {
    const candidate = await checkReconnectCandidate({ rootPath });
    if (candidate === null) {
      return false;
    }
    setReconnectCandidate({ rootPath, candidate });
    return true;
  };

  const onReconnect = () =>
    run(async () => {
      if (reconnectCandidate === null) {
        return;
      }
      const { rootPath, candidate } = reconnectCandidate;
      setReconnectCandidate(null);
      if (candidate.moved !== null) {
        const workspace = await reconnectMovedProject({
          workspaceId: candidate.workspaceId,
          projectId: candidate.moved.projectId,
          fromRoot: candidate.moved.fromRoot,
          toRoot: rootPath,
        });
        await completeWithWorkspace({ mode: 'project', workspace });
        return;
      }
      const workspace = await addWorkspace({ rootPath });
      await completeWithWorkspace({ mode: 'project', workspace });
    });

  const onCancelReconnect = () => setReconnectCandidate(null);

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
      await openWorkspace({ id: workspace.id, title: workspace.name, onRunning: 'new-window' });
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

  const primary =
    created !== null
      ? { label: 'Done', disabled: busy || linked.length === 0 }
      : choice === 'workspace'
        ? {
            label: busy ? 'Creating workspace…' : 'Create workspace',
            disabled: busy || workspaceName.trim().length === 0,
          }
        : null;

  const isPickingProject = created === null && choice === 'project';

  const actions = (
    <FormActions
      leading={
        error == null ? null : (
          <span role="alert" className="flex min-w-0 items-center gap-1 text-label text-danger">
            <AlertTriangle size={ICON_SIZE.row} aria-hidden className="shrink-0" />
            {error}
          </span>
        )
      }
    >
      {isPickingProject ? (
        <>
          <Button type="button" variant="secondary" disabled={busy} onClick={onNewProject}>
            <FolderPlus size={ICON_SIZE.control} aria-hidden />
            New project
          </Button>
          <Button type="button" variant="primary" disabled={busy} onClick={onPickProjectFolder}>
            <FolderGit2 size={ICON_SIZE.control} aria-hidden />
            Choose a folder
          </Button>
        </>
      ) : null}
      {primary !== null ? (
        <Button type="submit" form={formId} disabled={primary.disabled} aria-busy={busy}>
          {primary.label}
        </Button>
      ) : null}
    </FormActions>
  );

  return (
    <form id={formId} onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {created === null ? (
        <section className="flex flex-col gap-4">
          <SectionHeader
            icon={<FolderGit2 size={ICON_SIZE.row} aria-hidden />}
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
                  setReconnectCandidate(null);
                  clear();
                }}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-3 text-left motion-safe:transition-colors',
                  choice === option.value
                    ? cn(tintClasses('primary').border, tintClasses('primary').bgSoft)
                    : cn(
                        'border-border',
                        tintClasses('primary').hoverBorder,
                        tintClasses('primary').hoverBgSoft,
                      ),
                )}
              >
                <span className="mt-0.5 shrink-0 text-primary">
                  <option.icon size={ICON_SIZE.hero} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-row text-foreground">{option.label}</span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {option.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {choice === 'project' ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Pick a folder with a git repository, or let New project run git init in an empty
                one.
              </p>
              {reconnectCandidate !== null ? (
                <Notice
                  tone="info"
                  placement="inline"
                  title={`${reconnectCandidate.candidate.moved !== null ? 'This looks like it moved from' : 'This folder was part of'} ${reconnectCandidate.candidate.workspaceName}, disconnected ${formatAge({ from: reconnectCandidate.candidate.disconnectedAt, now })}, with ${reconnectCandidate.candidate.sessionCount} ${reconnectCandidate.candidate.sessionCount === 1 ? 'session' : 'sessions'}.`}
                  actions={
                    <>
                      <Button size="sm" disabled={busy} onClick={onReconnect}>
                        Reconnect {reconnectCandidate.candidate.workspaceName}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy}
                        onClick={onCancelReconnect}
                      >
                        Choose a different folder
                      </Button>
                    </>
                  }
                />
              ) : null}
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
                className="self-start text-label font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Link a plain folder (no git)
              </button>
            </div>
          ) : null}

          {choice === 'workspace' ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${formId}-workspace-name`}
                className="text-label font-medium text-foreground"
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
            icon={<FolderGit2 size={ICON_SIZE.row} aria-hidden />}
            label="Projects"
            hint={`Add the repositories ${created.name} works on.`}
          />

          {linked.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {linked.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center gap-3 rounded-lg border border-border-soft bg-subtle px-3 py-2"
                >
                  <span className="shrink-0 text-muted-foreground">
                    {project.kind === 'repo' ? (
                      <FolderGit2 size={ICON_SIZE.row} aria-hidden />
                    ) : (
                      <Folder size={ICON_SIZE.row} aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-row text-foreground">{project.name}</span>
                      <Chip
                        tone="neutral"
                        size="3xs"
                        bordered={false}
                        label={project.kind === 'repo' ? 'Repository' : 'Folder'}
                        className="shrink-0"
                      />
                    </span>
                    <span className="block truncate text-code text-muted-foreground">
                      {project.rootPath}
                    </span>
                  </span>
                  <Tooltip content={`Unlink ${project.name}`} anchorClassName="shrink-0">
                    <button
                      type="button"
                      aria-label={`Unlink ${project.name}`}
                      disabled={busy}
                      onClick={() => void removeProject({ projectId: project.id })}
                      className="rounded-md p-1 text-faint-foreground hover:bg-hover hover:text-foreground"
                    >
                      <X size={ICON_SIZE.control} aria-hidden />
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
              <Plus size={ICON_SIZE.control} aria-hidden /> Add
            </Button>
            <Button type="button" variant="secondary" onClick={onNewLinkedProject} disabled={busy}>
              <FolderPlus size={ICON_SIZE.control} aria-hidden /> New project
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
            className="self-start text-label font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Link a plain folder (no git)
          </button>
        </section>
      )}

      {primary !== null || error != null || isPickingProject ? actions : null}
    </form>
  );
};
