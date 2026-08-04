import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Button,
  Chip,
  Divider,
  FieldRow,
  Input,
  ScrollFade,
  SectionHeader,
  SegmentedTabs,
  StatusDot,
  cn,
} from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { AlertTriangle, Boxes, Check, Folder, FolderGit2 } from 'lucide-react';
import { useAppStore, useWorkspaces } from '../../../../store';
import { AppBreadcrumb } from '../../../../app/components/AppBreadcrumb';
import { buildBreadcrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { formatError } from '../../../../shared/lib/errors';
import { validateGitRepo } from '../../../../shared/lib/repo';
import { defaultSimpleWorkspacePath } from '../../defaultSimpleWorkspacePath';
import { commonParentDirectory } from './commonParentDirectory';
import { lastPathSegment } from './lastPathSegment';

export type WorkspaceLinkMode = 'single' | 'multi' | 'simple';

type Props = {
  readonly onComplete: (params: { readonly mode: WorkspaceLinkMode }) => void;
  readonly onCancel: () => void;
  readonly cancelLabel?: string;
  readonly showBreadcrumb: boolean;
  readonly modes: ReadonlyArray<WorkspaceLinkMode>;
  readonly footerContainer?: HTMLElement | null;
  readonly draftStorageKey?: string;
};

type Mode = WorkspaceLinkMode;

const DEFAULT_SIMPLE_NAME = 'My workspace';
const WORKSPACE_LINK_DRAFT_VERSION = 1;

const MODE_OPTIONS = [
  { value: 'single', label: 'Single project', icon: FolderGit2 },
  { value: 'multi', label: 'Multi project', icon: Boxes },
  { value: 'simple', label: 'Standalone', icon: Folder },
] as const;

type WorkspaceLinkDraft = {
  readonly v: number;
  readonly mode: WorkspaceLinkMode;
  readonly path: string;
  readonly selected: ReadonlyArray<string>;
  readonly mountNames: Record<string, string>;
  readonly containerPath: string;
  readonly containerEdited: boolean;
  readonly compositeName: string;
  readonly simpleName: string;
  readonly simplePath: string;
  readonly simplePathEdited: boolean;
};

const readMode = ({ value }: { readonly value: unknown }): WorkspaceLinkMode | null => {
  if (value === 'single' || value === 'multi' || value === 'simple') {
    return value;
  }
  return null;
};

const readStringArray = ({ value }: { readonly value: unknown }): ReadonlyArray<string> | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  if (!value.every((item) => typeof item === 'string')) {
    return null;
  }
  return value;
};

const readStringRecord = ({
  value,
}: {
  readonly value: unknown;
}): Record<string, string> | null => {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  if (!Object.values(value).every((item) => typeof item === 'string')) {
    return null;
  }
  return value as Record<string, string>;
};

const readDraft = ({ storageKey }: { readonly storageKey: string }): WorkspaceLinkDraft | null => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (record['v'] !== WORKSPACE_LINK_DRAFT_VERSION) {
      return null;
    }
    const mode = readMode({ value: record['mode'] });
    if (mode === null) {
      return null;
    }
    const path = typeof record['path'] === 'string' ? record['path'] : null;
    if (path === null) {
      return null;
    }
    const selected = readStringArray({ value: record['selected'] });
    if (selected === null) {
      return null;
    }
    const mountNames = readStringRecord({ value: record['mountNames'] });
    if (mountNames === null) {
      return null;
    }
    const containerPath =
      typeof record['containerPath'] === 'string' ? record['containerPath'] : null;
    if (containerPath === null) {
      return null;
    }
    const containerEdited =
      typeof record['containerEdited'] === 'boolean' ? record['containerEdited'] : null;
    if (containerEdited === null) {
      return null;
    }
    const compositeName =
      typeof record['compositeName'] === 'string' ? record['compositeName'] : null;
    if (compositeName === null) {
      return null;
    }
    const simpleName = typeof record['simpleName'] === 'string' ? record['simpleName'] : null;
    if (simpleName === null) {
      return null;
    }
    const simplePath = typeof record['simplePath'] === 'string' ? record['simplePath'] : null;
    if (simplePath === null) {
      return null;
    }
    const simplePathEdited =
      typeof record['simplePathEdited'] === 'boolean' ? record['simplePathEdited'] : null;
    if (simplePathEdited === null) {
      return null;
    }
    return {
      v: WORKSPACE_LINK_DRAFT_VERSION,
      mode,
      path,
      selected,
      mountNames,
      containerPath,
      containerEdited,
      compositeName,
      simpleName,
      simplePath,
      simplePathEdited,
    };
  } catch {
    return null;
  }
};

const writeDraft = ({
  storageKey,
  draft,
}: {
  readonly storageKey: string;
  readonly draft: WorkspaceLinkDraft;
}): void => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {}
};

const clearDraft = ({ storageKey }: { readonly storageKey: string }): void => {
  try {
    localStorage.removeItem(storageKey);
  } catch {}
};

export const WorkspaceLinkForm = ({
  onComplete,
  onCancel,
  cancelLabel = 'Cancel',
  showBreadcrumb,
  modes,
  footerContainer,
  draftStorageKey,
}: Props) => {
  const formId = useId();
  const addWorkspace = useAppStore((state) => state.addWorkspace);
  const addCompositeWorkspace = useAppStore((state) => state.addCompositeWorkspace);
  const addSimpleWorkspace = useAppStore((state) => state.addSimpleWorkspace);
  const setCurrentWorkspace = useAppStore((state) => state.setCurrentWorkspace);
  const workspaces = useWorkspaces();
  const linkable = useMemo(
    () =>
      workspaces.filter(
        (workspace) => workspace.kind !== 'composite' && workspace.kind !== 'simple',
      ),
    [workspaces],
  );

  const [mode, setMode] = useState<Mode>(modes[0] ?? 'single');
  const [path, setPath] = useState('');
  const [validating, setValidating] = useState(false);
  const [validPath, setValidPath] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<ReadonlyArray<string>>([]);
  const [mountNames, setMountNames] = useState<Record<string, string>>({});
  const [containerPath, setContainerPath] = useState('');
  const [containerEdited, setContainerEdited] = useState(false);
  const [compositeName, setCompositeName] = useState('');
  const [simpleName, setSimpleName] = useState(DEFAULT_SIMPLE_NAME);
  const [simplePath, setSimplePath] = useState('');
  const [simplePathEdited, setSimplePathEdited] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(draftStorageKey == null);
  const persistDraftRef = useRef(true);
  const latestDraftRef = useRef<WorkspaceLinkDraft | null>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (modes.includes(mode)) {
      return;
    }
    setMode(modes[0] ?? 'single');
  }, [mode, modes]);

  useEffect(() => {
    persistDraftRef.current = true;
    if (draftStorageKey == null) {
      setDraftLoaded(true);
      return;
    }
    const draft = readDraft({ storageKey: draftStorageKey });
    if (draft === null) {
      setDraftLoaded(true);
      return;
    }
    setMode(modes.includes(draft.mode) ? draft.mode : (modes[0] ?? 'single'));
    setPath(draft.path);
    setSelected(draft.selected);
    setMountNames(draft.mountNames);
    setContainerPath(draft.containerPath);
    setContainerEdited(draft.containerEdited);
    setCompositeName(draft.compositeName);
    setSimpleName(draft.simpleName);
    setSimplePath(draft.simplePath);
    setSimplePathEdited(draft.simplePathEdited);
    setDraftLoaded(true);
  }, [draftStorageKey, modes]);

  useLayoutEffect(() => {
    if (!draftLoaded || draftStorageKey == null || !persistDraftRef.current) {
      return;
    }
    const draft: WorkspaceLinkDraft = {
      v: WORKSPACE_LINK_DRAFT_VERSION,
      mode,
      path,
      selected,
      mountNames,
      containerPath,
      containerEdited,
      compositeName,
      simpleName,
      simplePath,
      simplePathEdited,
    };
    latestDraftRef.current = draft;
    writeDraft({
      storageKey: draftStorageKey,
      draft,
    });
  }, [
    draftLoaded,
    draftStorageKey,
    mode,
    path,
    selected,
    mountNames,
    containerPath,
    containerEdited,
    compositeName,
    simpleName,
    simplePath,
    simplePathEdited,
  ]);

  useEffect(() => {
    return () => {
      if (draftStorageKey == null || !persistDraftRef.current) {
        return;
      }
      const draft = latestDraftRef.current;
      if (draft === null) {
        return;
      }
      writeDraft({ storageKey: draftStorageKey, draft });
    };
  }, [draftStorageKey]);

  useEffect(() => {
    if (mode !== 'simple' || simplePathEdited) {
      return;
    }

    let cancelled = false;
    void defaultSimpleWorkspacePath({ name: simpleName })
      .then((suggestedPath) => {
        if (!cancelled) {
          setSimplePath(suggestedPath);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSimplePath('');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mode, simpleName, simplePathEdited]);

  useEffect(() => {
    if (path.length === 0) {
      setValidating(false);
      setValidPath(false);
      setValidationError(null);
      return;
    }

    setValidating(true);
    setValidPath(false);
    setValidationError(null);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void validateGitRepo(path)
        .then((result) => {
          if (cancelled) {
            return;
          }
          if (result.isRepo) {
            setValidPath(true);
            setValidationError(null);
            return;
          }
          setValidPath(false);
          setValidationError(result.error ?? 'Not a git repository.');
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setValidPath(false);
          setValidationError('Could not validate path.');
        })
        .finally(() => {
          if (!cancelled) {
            setValidating(false);
          }
        });
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [path]);

  const selectedWorkspaces = useMemo(
    () =>
      selected
        .map((id) => linkable.find((workspace) => workspace.id === id))
        .filter((workspace): workspace is Workspace => workspace !== undefined),
    [selected, linkable],
  );

  const suggestedContainer = useMemo(() => {
    if (selectedWorkspaces.length < 2) {
      return '';
    }

    const parent = commonParentDirectory({
      paths: selectedWorkspaces.map((workspace) => workspace.rootPath),
    });
    if (parent.length === 0) {
      return '';
    }

    const mounts = selectedWorkspaces.map(
      (workspace) => mountNames[workspace.id] ?? lastPathSegment({ path: workspace.rootPath }),
    );
    return `${parent}/${mounts.join('+')}`;
  }, [selectedWorkspaces, mountNames]);

  useEffect(() => {
    if (!draftLoaded || containerEdited) {
      return;
    }
    setContainerPath(suggestedContainer);
  }, [suggestedContainer, containerEdited, draftLoaded]);

  const toggleMember = useCallback(({ workspace }: { readonly workspace: Workspace }) => {
    setSelected((previous) =>
      previous.includes(workspace.id)
        ? previous.filter((id) => id !== workspace.id)
        : [...previous, workspace.id],
    );
    setMountNames((previous) =>
      (previous[workspace.id] ?? '').length > 0
        ? previous
        : { ...previous, [workspace.id]: lastPathSegment({ path: workspace.rootPath }) },
    );
  }, []);

  const onPick = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string') {
      return;
    }
    setPath(picked);
    pathInputRef.current?.focus();
  }, []);

  const onPickContainer = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string') {
      return;
    }
    setContainerEdited(true);
    setContainerPath(picked);
  }, []);

  const onPickSimple = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== 'string') {
      return;
    }
    setSimplePathEdited(true);
    setSimplePath(picked);
  }, []);

  const clearPersistedDraft = useCallback(() => {
    if (draftStorageKey == null) {
      return;
    }
    persistDraftRef.current = false;
    clearDraft({ storageKey: draftStorageKey });
  }, [draftStorageKey]);

  const onCancelClick = useCallback(() => {
    clearPersistedDraft();
    onCancel();
  }, [clearPersistedDraft, onCancel]);

  const onSubmitSingle = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const workspace = await addWorkspace({ rootPath: path });
      await setCurrentWorkspace(workspace.id);
      clearPersistedDraft();
      setPath('');
      setValidPath(false);
      setValidationError(null);
      onComplete({ mode: 'single' });
    } catch (error) {
      setSubmitError(formatError(error));
    } finally {
      setBusy(false);
    }
  }, [path, addWorkspace, setCurrentWorkspace, clearPersistedDraft, onComplete]);

  const onSubmitMulti = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const members = selectedWorkspaces.map((workspace) => ({
        workspaceId: workspace.id,
        mountName: (
          mountNames[workspace.id] ?? lastPathSegment({ path: workspace.rootPath })
        ).trim(),
      }));
      const workspace = await addCompositeWorkspace({
        name: compositeName,
        containerPath: containerPath.trim(),
        members,
      });
      await setCurrentWorkspace(workspace.id);
      clearPersistedDraft();
      onComplete({ mode: 'multi' });
    } catch (error) {
      setSubmitError(formatError(error));
    } finally {
      setBusy(false);
    }
  }, [
    selectedWorkspaces,
    mountNames,
    compositeName,
    containerPath,
    addCompositeWorkspace,
    setCurrentWorkspace,
    clearPersistedDraft,
    onComplete,
  ]);

  const onSubmitSimple = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const workspace = await addSimpleWorkspace({
        name: simpleName.trim(),
        path: simplePath.trim(),
      });
      await setCurrentWorkspace(workspace.id);
      clearPersistedDraft();
      onComplete({ mode: 'simple' });
    } catch (error) {
      setSubmitError(formatError(error));
    } finally {
      setBusy(false);
    }
  }, [
    addSimpleWorkspace,
    clearPersistedDraft,
    onComplete,
    setCurrentWorkspace,
    simpleName,
    simplePath,
  ]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'single') {
      void onSubmitSingle();
      return;
    }
    if (mode === 'multi') {
      void onSubmitMulti();
      return;
    }
    void onSubmitSimple();
  };

  const mountValues = selectedWorkspaces.map((workspace) =>
    (mountNames[workspace.id] ?? lastPathSegment({ path: workspace.rootPath })).trim(),
  );
  const mountsValid =
    mountValues.every((mount) => mount.length > 0) &&
    new Set(mountValues).size === mountValues.length;
  const multiDisabled =
    busy || selectedWorkspaces.length < 2 || containerPath.trim().length === 0 || !mountsValid;
  const simpleDisabled = busy || simpleName.trim().length === 0 || simplePath.trim().length === 0;
  const primaryDisabled =
    mode === 'single' ? busy || !validPath : mode === 'multi' ? multiDisabled : simpleDisabled;
  const previewMounts = selectedWorkspaces.map(
    (workspace) => mountNames[workspace.id] ?? lastPathSegment({ path: workspace.rootPath }),
  );
  const actionLabel =
    mode === 'single'
      ? busy
        ? 'Adding workspace…'
        : 'Add workspace'
      : mode === 'multi'
        ? busy
          ? 'Linking projects…'
          : 'Link projects'
        : busy
          ? 'Creating workspace…'
          : 'Create workspace';
  const sectionHint =
    mode === 'single'
      ? 'Work in one git repository.'
      : mode === 'multi'
        ? 'Link related repositories so one session can work across all of them.'
        : 'Use agents, workflows, and shared context in a standalone project space.';
  const breadcrumbCrumbs = buildBreadcrumb({
    workspace: null,
    session: null,
    chrome: { kind: 'workspace-create' },
    handlers: {
      toOverview: onCancelClick,
      toWorkspaceLauncher: () => {
        onCancelClick();
        window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
      },
      toWorkspaceBoard: onCancelClick,
    },
  });

  const actions = (
    <>
      {submitError != null ? (
        <span role="alert" className="flex min-w-0 flex-1 items-center gap-1 text-xs text-danger">
          <AlertTriangle size={12} aria-hidden className="shrink-0" />
          {submitError}
        </span>
      ) : (
        <span className="min-w-0 flex-1" aria-hidden />
      )}
      <Button type="button" variant="ghost" onClick={onCancelClick} disabled={busy}>
        {cancelLabel}
      </Button>
      <Button type="submit" form={formId} disabled={primaryDisabled} aria-busy={busy}>
        {actionLabel}
      </Button>
    </>
  );

  return (
    <form id={formId} onSubmit={onSubmit} className="flex w-full flex-col gap-6">
      {showBreadcrumb ? <AppBreadcrumb crumbs={breadcrumbCrumbs} /> : null}

      <section className="flex flex-col">
        <SectionHeader
          icon={<FolderGit2 size={12} aria-hidden />}
          label="Workspace details"
          hint={sectionHint}
        />
        {modes.length > 1 ? (
          <>
            <FieldRow
              label="Workspace type"
              help="Choose a repository, linked projects, or a standalone workspace."
              layout="stacked"
            >
              <SegmentedTabs
                ariaLabel="Workspace type"
                options={MODE_OPTIONS.filter((option) => modes.includes(option.value))}
                value={mode}
                onChange={(nextMode) => {
                  setMode(nextMode);
                  setSubmitError(null);
                }}
                fill
              />
            </FieldRow>
            <Divider />
          </>
        ) : null}

        {mode === 'single' ? (
          <FieldRow
            label="Repository path"
            help="The directory needs a .git folder."
            layout="stacked"
          >
            <div className="flex w-full gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input
                  ref={pathInputRef}
                  autoFocus
                  value={path}
                  placeholder="/path/to/repo"
                  onChange={(event) => setPath(event.target.value)}
                  disabled={busy}
                  aria-label="Repository path"
                />
                {validating ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <StatusDot tone="info" size="sm" pulsing />
                    Checking…
                  </span>
                ) : validPath ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check size={11} aria-hidden />
                    Valid git repository
                  </span>
                ) : validationError != null && path.length > 0 ? (
                  <span role="alert" className="text-xs text-danger">
                    {validationError}
                  </span>
                ) : null}
              </div>
              <Button variant="secondary" onClick={() => void onPick()} disabled={busy}>
                Browse
              </Button>
            </div>
          </FieldRow>
        ) : mode === 'multi' ? (
          <>
            <FieldRow
              label="Projects"
              help="Select at least two repository-backed workspaces."
              layout="stacked"
            >
              {linkable.length < 2 ? (
                <div
                  role="alert"
                  className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                >
                  Add at least two single-project workspaces first, then link them here.
                </div>
              ) : (
                <ScrollFade className="max-h-44">
                  <ul className="flex flex-col gap-0.5">
                    {linkable.map((workspace) => {
                      const isSelected = selected.includes(workspace.id);
                      return (
                        <li key={workspace.id}>
                          <button
                            type="button"
                            onClick={() => toggleMember({ workspace })}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs motion-safe:transition-colors',
                              isSelected
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-transparent hover:bg-muted/50',
                            )}
                          >
                            <span
                              className={cn(
                                'flex size-4 shrink-0 items-center justify-center rounded border',
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border',
                              )}
                            >
                              {isSelected ? <Check size={11} aria-hidden /> : null}
                            </span>
                            <span className="font-medium text-foreground">{workspace.name}</span>
                            <span className="min-w-0 flex-1 truncate text-right text-muted-foreground">
                              {workspace.rootPath}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ScrollFade>
              )}
            </FieldRow>

            {selectedWorkspaces.length > 0 ? (
              <>
                <Divider />
                <FieldRow
                  label="Mount names"
                  help="Each selected project needs a unique directory name."
                  layout="stacked"
                >
                  <div className="flex flex-col gap-2">
                    {selectedWorkspaces.map((workspace) => (
                      <div key={workspace.id} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                          {workspace.name}
                        </span>
                        <Input
                          value={
                            mountNames[workspace.id] ??
                            lastPathSegment({ path: workspace.rootPath })
                          }
                          onChange={(event) =>
                            setMountNames((previous) => ({
                              ...previous,
                              [workspace.id]: event.target.value,
                            }))
                          }
                          disabled={busy}
                          aria-label={`${workspace.name} mount name`}
                          className="min-w-0 flex-1"
                        />
                      </div>
                    ))}
                    {!mountsValid ? (
                      <span role="alert" className="text-xs text-danger">
                        Mount names must be non-empty and unique.
                      </span>
                    ) : null}
                  </div>
                </FieldRow>
              </>
            ) : null}

            <Divider />
            <FieldRow
              label="Save into folder"
              help="Sessions create their linked project directories inside this folder."
              layout="stacked"
            >
              <div className="flex w-full gap-2">
                <Input
                  value={containerPath}
                  placeholder="/path/to/container"
                  onChange={(event) => {
                    setContainerEdited(true);
                    setContainerPath(event.target.value);
                  }}
                  disabled={busy}
                  aria-label="Container path"
                  className="min-w-0 flex-1"
                />
                <Button variant="secondary" onClick={() => void onPickContainer()} disabled={busy}>
                  Browse
                </Button>
              </div>
            </FieldRow>

            {selectedWorkspaces.length >= 2 && containerPath.trim().length > 0 ? (
              <>
                <Divider />
                <FieldRow label="Preview" layout="stacked">
                  <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
                    {`${lastPathSegment({ path: containerPath })}/\n└── <session>/\n${previewMounts
                      .map(
                        (mount, index) =>
                          `    ${index === previewMounts.length - 1 ? '└──' : '├──'} ${mount}/`,
                      )
                      .join('\n')}`}
                  </pre>
                </FieldRow>
              </>
            ) : null}

            <Divider />
            <FieldRow
              label="Name"
              help="Name the linked workspace or keep the suggested project names."
              layout="stacked"
            >
              <Input
                value={compositeName}
                placeholder={previewMounts.join(' + ')}
                onChange={(event) => setCompositeName(event.target.value)}
                disabled={busy}
                aria-label="Workspace name"
              />
            </FieldRow>
          </>
        ) : (
          <>
            <FieldRow label="Name" help="Name the standalone workspace." layout="stacked">
              <Input
                autoFocus
                value={simpleName}
                placeholder="My workspace"
                onChange={(event) => setSimpleName(event.target.value)}
                disabled={busy}
                aria-label="Workspace name"
              />
            </FieldRow>
            <Divider />
            <FieldRow
              label="Directory"
              help="The directory is created when it does not exist."
              layout="stacked"
            >
              <div className="flex w-full gap-2">
                <Input
                  value={simplePath}
                  placeholder="/path/to/workspace"
                  onChange={(event) => {
                    setSimplePathEdited(true);
                    setSimplePath(event.target.value);
                  }}
                  disabled={busy}
                  aria-label="Workspace directory"
                  className="min-w-0 flex-1"
                />
                <Button variant="secondary" onClick={() => void onPickSimple()} disabled={busy}>
                  Browse
                </Button>
              </div>
            </FieldRow>
          </>
        )}
      </section>

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
