import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Button, Dialog, Input, ScrollFade, SegmentedTabs, StatusDot, cn } from '@goodboy/ui';
import type { Workspace, WorkspaceId } from '@goodboy/types';
import { Boxes, Check, Folder, FolderGit2, FolderPlus } from 'lucide-react';
import { useAppStore, useWorkspaces } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { validateGitRepo } from '../../../../shared/lib/repo';
import { AppBreadcrumb } from '../../../../app/components/AppBreadcrumb';
import { buildBreadcrumb } from '../../../../app/components/AppBreadcrumb/buildBreadcrumb';
import { isWizardDone, reopenWizard } from '../../../onboarding/onboarding-store';
import { defaultSimpleWorkspacePath } from '../../defaultSimpleWorkspacePath';

type Props = {
  open: boolean;
  onClose: () => void;
};

type Mode = 'single' | 'multi' | 'simple';

const DEFAULT_SIMPLE_NAME = 'My workspace';

const lastSegment = (p: string): string => p.split('/').filter(Boolean).at(-1) ?? p;

const commonParentDir = (paths: ReadonlyArray<string>): string => {
  if (paths.length === 0) {
    return '';
  }
  const split = paths.map((p) => p.split('/'));
  const first = split[0]!;
  const shared: string[] = [];
  for (let i = 0; i < first.length; i += 1) {
    const seg = first[i];
    if (split.every((s) => s[i] === seg)) {
      shared.push(seg!);
    } else {
      break;
    }
  }
  return shared.join('/');
};

export const WorkspaceLinkDialog = ({ open, onClose }: Props) => {
  const addWorkspace = useAppStore((s) => s.addWorkspace);
  const addCompositeWorkspace = useAppStore((s) => s.addCompositeWorkspace);
  const addSimpleWorkspace = useAppStore((s) => s.addSimpleWorkspace);
  const setCurrentWorkspace = useAppStore((s) => s.setCurrentWorkspace);
  const workspaces = useWorkspaces();
  const linkable = useMemo(
    () => workspaces.filter((w) => w.kind !== 'composite' && w.kind !== 'simple'),
    [workspaces],
  );

  const [mode, setMode] = useState<Mode>('single');

  const [path, setPath] = useState('');
  const [validating, setValidating] = useState(false);
  const [validPath, setValidPath] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selected, setSelected] = useState<ReadonlyArray<WorkspaceId>>([]);
  const [mountNames, setMountNames] = useState<Record<string, string>>({});
  const [containerPath, setContainerPath] = useState('');
  const [containerEdited, setContainerEdited] = useState(false);
  const [compositeName, setCompositeName] = useState('');
  const [simpleName, setSimpleName] = useState(DEFAULT_SIMPLE_NAME);
  const [simplePath, setSimplePath] = useState('');
  const [simplePathEdited, setSimplePathEdited] = useState(false);

  const pathInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode('single');
    setPath('');
    setValidating(false);
    setValidPath(false);
    setValidationError(null);
    setSubmitError(null);
    setBusy(false);
    setSelected([]);
    setMountNames({});
    setContainerPath('');
    setContainerEdited(false);
    setCompositeName('');
    setSimpleName(DEFAULT_SIMPLE_NAME);
    setSimplePath('');
    setSimplePathEdited(false);
  }, [open]);

  useEffect(() => {
    if (!open || mode !== 'simple' || simplePathEdited) {
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
  }, [mode, open, simpleName, simplePathEdited]);

  useEffect(() => {
    if (path.length === 0) {
      setValidPath(false);
      setValidationError(null);
      return;
    }
    setValidating(true);
    setValidPath(false);
    setValidationError(null);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await validateGitRepo(path);
          if (result.isRepo) {
            setValidPath(true);
            setValidationError(null);
          } else {
            setValidPath(false);
            setValidationError(result.error ?? 'not a git repository');
          }
        } catch {
          setValidPath(false);
          setValidationError('could not validate path');
        } finally {
          setValidating(false);
        }
      })();
    }, 400);
    return () => clearTimeout(timer);
  }, [path]);

  const selectedWorkspaces = useMemo(
    () =>
      selected
        .map((id) => linkable.find((w) => w.id === id))
        .filter((w): w is Workspace => w !== undefined),
    [selected, linkable],
  );

  const suggestedContainer = useMemo(() => {
    if (selectedWorkspaces.length < 2) {
      return '';
    }
    const parent = commonParentDir(selectedWorkspaces.map((w) => w.rootPath));
    if (parent.length === 0) {
      return '';
    }
    const mounts = selectedWorkspaces.map((w) => mountNames[w.id] ?? lastSegment(w.rootPath));
    return `${parent}/${mounts.join('+')}`;
  }, [selectedWorkspaces, mountNames]);

  useEffect(() => {
    if (!containerEdited) {
      setContainerPath(suggestedContainer);
    }
  }, [suggestedContainer, containerEdited]);

  const toggleMember = useCallback((ws: Workspace) => {
    setSelected((prev) =>
      prev.includes(ws.id) ? prev.filter((id) => id !== ws.id) : [...prev, ws.id],
    );
    setMountNames((prev) => (prev[ws.id] ? prev : { ...prev, [ws.id]: lastSegment(ws.rootPath) }));
  }, []);

  const onPick = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string') {
      setPath(picked);
      pathInputRef.current?.focus();
    }
  }, []);

  const onPickContainer = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string') {
      setContainerEdited(true);
      setContainerPath(picked);
    }
  }, []);

  const onPickSimple = useCallback(async () => {
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked === 'string') {
      setSimplePathEdited(true);
      setSimplePath(picked);
    }
  }, []);

  const onSubmitSingle = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const ws = await addWorkspace({ rootPath: path });
      await setCurrentWorkspace(ws.id);
      onClose();
      if (!isWizardDone()) {
        reopenWizard('setup');
      }
    } catch (err) {
      setSubmitError(formatError(err));
    } finally {
      setBusy(false);
    }
  }, [path, addWorkspace, setCurrentWorkspace, onClose]);

  const onSubmitMulti = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const members = selectedWorkspaces.map((w) => ({
        workspaceId: w.id,
        mountName: (mountNames[w.id] ?? lastSegment(w.rootPath)).trim(),
      }));
      const ws = await addCompositeWorkspace({
        name: compositeName,
        containerPath: containerPath.trim(),
        members,
      });
      await setCurrentWorkspace(ws.id);
      onClose();
      if (!isWizardDone()) {
        reopenWizard('setup');
      }
    } catch (err) {
      setSubmitError(formatError(err));
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
    onClose,
  ]);

  const onSubmitSimple = useCallback(async () => {
    setBusy(true);
    setSubmitError(null);
    try {
      const ws = await addSimpleWorkspace({
        name: simpleName.trim(),
        path: simplePath.trim(),
      });
      await setCurrentWorkspace(ws.id);
      onClose();
      if (!isWizardDone()) {
        reopenWizard('setup');
      }
    } catch (err) {
      setSubmitError(formatError(err));
    } finally {
      setBusy(false);
    }
  }, [addSimpleWorkspace, onClose, setCurrentWorkspace, simpleName, simplePath]);

  const mountValues = selectedWorkspaces.map((w) =>
    (mountNames[w.id] ?? lastSegment(w.rootPath)).trim(),
  );
  const mountsValid =
    mountValues.every((m) => m.length > 0) && new Set(mountValues).size === mountValues.length;
  const multiDisabled =
    busy || selectedWorkspaces.length < 2 || containerPath.trim().length === 0 || !mountsValid;
  const simpleDisabled = busy || simpleName.trim().length === 0 || simplePath.trim().length === 0;
  const primaryDisabled =
    mode === 'single' ? busy || !validPath : mode === 'multi' ? multiDisabled : simpleDisabled;

  const previewMounts = selectedWorkspaces.map((w) => mountNames[w.id] ?? lastSegment(w.rootPath));

  const breadcrumbCrumbs = buildBreadcrumb({
    workspace: null,
    session: null,
    chrome: { kind: 'workspace-create' },
    handlers: {
      toOverview: onClose,
      toWorkspaceLauncher: () => {
        onClose();
        window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher'));
      },
      toWorkspaceBoard: onClose,
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title="Add workspace"
      description="Add a project, link projects, or create a simple workspace."
      footer={
        <>
          {submitError ? <span className="mr-auto text-xs text-danger">{submitError}</span> : null}
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              void (mode === 'single'
                ? onSubmitSingle()
                : mode === 'multi'
                  ? onSubmitMulti()
                  : onSubmitSimple())
            }
            disabled={primaryDisabled}
            aria-busy={busy}
            className={busy ? 'animate-border-pulse' : undefined}
          >
            {mode === 'single'
              ? 'Add workspace'
              : mode === 'multi'
                ? 'Link projects'
                : 'Create workspace'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <AppBreadcrumb crumbs={breadcrumbCrumbs} />
        <SegmentedTabs
          ariaLabel="Workspace type"
          options={[
            { value: 'single', label: 'Single project', icon: FolderGit2 },
            { value: 'multi', label: 'Multi project', icon: Boxes, badge: 'beta' },
            { value: 'simple', label: 'Simple', icon: Folder },
          ]}
          value={mode}
          onChange={setMode}
          fill
        />

        <p className="text-xs leading-relaxed text-muted-foreground">
          {mode === 'single'
            ? 'Work in one git repository.'
            : mode === 'multi'
              ? 'Working on both a frontend and a backend? Link them into one workspace so a single chat can work across all of them.'
              : 'Use agents, workflows, and shared context in a standalone project space.'}
        </p>

        {mode === 'single' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <FolderPlus size={15} className="shrink-0 text-muted-foreground" aria-hidden />
              <span className="font-semibold">repository</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">repository path</span>
              <div className="flex gap-2">
                <Input
                  ref={pathInputRef}
                  autoFocus
                  value={path}
                  placeholder="/path/to/repo"
                  onChange={(e) => setPath(e.target.value)}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => void onPick()} disabled={busy}>
                  Browse
                </Button>
              </div>
              {validating ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <StatusDot tone="info" size="sm" pulsing />
                  checking…
                </span>
              ) : validPath ? (
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check size={11} aria-hidden />
                  valid git repository
                </span>
              ) : validationError && path.length > 0 ? (
                <span className="text-xs text-danger">{validationError}</span>
              ) : (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  the directory needs a <code>.git</code> folder.
                </p>
              )}
            </div>
          </div>
        ) : mode === 'multi' ? (
          <div className="flex flex-col gap-4">
            {linkable.length < 2 ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                Add at least two single-project workspaces first, then link them here.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground">pick repos to link</span>
                  <ScrollFade className="max-h-44">
                    <ul className="flex flex-col gap-0.5">
                      {linkable.map((ws) => {
                        const isOn = selected.includes(ws.id);
                        return (
                          <li key={ws.id}>
                            <button
                              type="button"
                              onClick={() => toggleMember(ws)}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors',
                                isOn
                                  ? 'border-primary/50 bg-primary/5'
                                  : 'border-transparent hover:bg-muted/50',
                              )}
                            >
                              <span
                                className={cn(
                                  'flex size-4 shrink-0 items-center justify-center rounded border',
                                  isOn
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border',
                                )}
                              >
                                {isOn ? <Check size={11} aria-hidden /> : null}
                              </span>
                              <span className="font-medium text-foreground">{ws.name}</span>
                              <span className="ml-auto truncate text-muted-foreground">
                                {ws.rootPath}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </ScrollFade>
                </div>

                {selectedWorkspaces.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-foreground">mount names</span>
                    {selectedWorkspaces.map((ws) => (
                      <div key={ws.id} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
                          {ws.name}
                        </span>
                        <Input
                          value={mountNames[ws.id] ?? lastSegment(ws.rootPath)}
                          onChange={(e) =>
                            setMountNames((prev) => ({ ...prev, [ws.id]: e.target.value }))
                          }
                          className="flex-1"
                        />
                      </div>
                    ))}
                    {!mountsValid && (
                      <span className="text-xs text-danger">
                        mount names must be non-empty and unique.
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground">save into folder</span>
                  <div className="flex gap-2">
                    <Input
                      value={containerPath}
                      placeholder="/path/to/container"
                      onChange={(e) => {
                        setContainerEdited(true);
                        setContainerPath(e.target.value);
                      }}
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => void onPickContainer()}
                      disabled={busy}
                    >
                      Browse
                    </Button>
                  </div>
                </div>

                {selectedWorkspaces.length >= 2 && containerPath.trim().length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold text-foreground">preview</span>
                    <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-2xs leading-relaxed text-muted-foreground">
                      {`${lastSegment(containerPath)}/\n└── <session>/\n${previewMounts
                        .map(
                          (m, i) => `    ${i === previewMounts.length - 1 ? '└──' : '├──'} ${m}/`,
                        )
                        .join('\n')}`}
                    </pre>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-foreground">name</span>
                  <Input
                    value={compositeName}
                    placeholder={previewMounts.join(' + ')}
                    onChange={(e) => setCompositeName(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">name</span>
              <Input
                autoFocus
                value={simpleName}
                placeholder="My workspace"
                onChange={(event) => setSimpleName(event.target.value)}
                disabled={busy}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">directory</span>
              <div className="flex gap-2">
                <Input
                  value={simplePath}
                  placeholder="/path/to/workspace"
                  onChange={(event) => {
                    setSimplePathEdited(true);
                    setSimplePath(event.target.value);
                  }}
                  disabled={busy}
                  className="flex-1"
                />
                <Button variant="secondary" onClick={() => void onPickSimple()} disabled={busy}>
                  Browse
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The directory is created when it does not exist.
              </p>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
};
