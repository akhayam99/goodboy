import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Divider, Input, ScrollFade, Skeleton, Textarea, cn } from '@goodboy/ui';
import { AlertTriangle, GitBranch, Inbox, Paperclip, Target, Wand2 } from 'lucide-react';
import type { ProviderId, SessionId, WorkspaceId, WorkspaceIntegration } from '@goodboy/types';
import { resolveTaskModel } from '@goodboy/core';
import { AttachmentChip } from '../../../chat/components/ChatInput/parts/AttachmentChip';
import { toAttachmentInput } from '../../../chat/components/ChatInput/lib';
import { usePendingAttachments } from '../../../chat/components/ChatInput/hooks/usePendingAttachments';
import { ATTACHMENT_ACCEPT } from '../../../chat/attachment-kinds';
import { settingBranchPrefix, DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import {
  listLocalBranches,
  removeWorktree,
  type LocalBranchInfo,
} from '../../../../features/worktree/worktree';
import { useBranchConflict } from '../../../../features/worktree/useBranchConflict';
import { BranchCombobox } from '../../../../features/worktree/BranchCombobox';
import { useRemoteHostKind } from '../../../../features/worktree/useRemoteHostKind';
import type { IssueCandidate } from '../../../../features/integrations/fetchIssueCandidates';
import { resolveIssueSources } from '../../../../features/integrations/issueSources';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { isMissingBaseRefError } from '../../../../shared/lib/errors';
import { isValidBranchSlug as validateBranchSlug } from '../../../../shared/utils/isValidBranchSlug';
import { sanitizeBranchPrefix } from '../../../../shared/utils/sanitizeBranchPrefix';
import { sanitizeBranchSlug as sanitizeBranchSlugValue } from '../../../../shared/utils/sanitizeBranchSlug';
import { slugifyBranch } from '../../../../shared/utils/slugifyBranch';
import { SetupWorkflowToggle } from '../SetupWorkflowToggle';
import { useSetupWorkflowPreference } from '../../hooks/useSetupWorkflowPreference';
import { BranchModeToggle } from './BranchModeToggle';
import { generateBranchSlug } from './generateBranchSlug';
import { IssueSourceField } from './IssueSourceField';
import { Section } from './Section';

type Props = {
  onClose: () => void;
  workspaceId: WorkspaceId;
  onOpenSettings: () => void;
};

const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: 'Claude Code',
  cursor: 'cursor-agent',
  codex: 'OpenAI Codex',
  gemini: 'Google Gemini',
  opencode: 'OpenCode',
  openrouter: 'OpenRouter',
};

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  if (err && typeof err === 'object') {
    const maybe = err as { message?: unknown };
    if (typeof maybe.message === 'string') {
      return maybe.message;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return 'unknown error';
    }
  }
  return String(err);
}

const PROVIDER_ORDER: ReadonlyArray<ProviderId> = [
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
];

function pickDefaultProvider(connectedIds: ReadonlySet<ProviderId>): ProviderId {
  for (const id of PROVIDER_ORDER) {
    if (connectedIds.has(id)) {
      return id;
    }
  }
  return 'anthropic';
}

const SLUG_MAX_LEN = 48;

const slugifyLive = (input: string): string => slugifyBranch({ input, maxLength: SLUG_MAX_LEN });

const sanitizeBranchSlug = (input: string): string =>
  sanitizeBranchSlugValue({ input, maxLength: SLUG_MAX_LEN });

const sanitizePrefix = (input: string): string => sanitizeBranchPrefix({ input });

const EMPTY_LOCAL_BRANCHES: ReadonlyArray<LocalBranchInfo> = [];

const EMPTY_INTEGRATIONS: ReadonlyArray<WorkspaceIntegration> = [];

const isValidBranchSlug = (slug: string): boolean => validateBranchSlug({ slug });

export const NewSessionView = ({ onClose, workspaceId, onOpenSettings }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const providers = useAppStore((s) => s.providers);
  const { showToast } = useToast();
  const settingKey = settingBranchPrefix(workspaceId);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId));
  const isSimple = workspace?.kind === 'simple';
  const workspaceOverrides = useAppStore((s) => s.workspaceOverrides?.[workspaceId] ?? null);

  const [goal, setGoal] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [slugGenerating, setSlugGenerating] = useState(false);
  const [branchMode, setBranchMode] = useState<'new' | 'existing'>('new');
  const [existingBranches, setExistingBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [existingBranch, setExistingBranch] = useState<string>('');
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesLoaded, setBranchesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState<IssueCandidate | null>(null);
  const [setupWorkflow, setSetupWorkflow] = useSetupWorkflowPreference();

  const {
    attachments,
    isDragging,
    composerRef,
    fileInputRef,
    onFileInputChange,
    removeAttachment,
  } = usePendingAttachments({ showToast });

  const workspaceIntegrations = useAppStore(
    useShallow((s) => s.workspaceIntegrations?.[workspaceId] ?? EMPTY_INTEGRATIONS),
  );
  const remoteKind = useRemoteHostKind(workspaceId);
  const issueSources = isSimple
    ? []
    : resolveIssueSources({
        integrations: workspaceIntegrations,
        remoteKind,
      });

  const connectedProviders = providers.filter((p) => p.connection === 'connected');
  const noProviderConnected = providers.length > 0 && connectedProviders.length === 0;
  const connectedProviderIds = new Set(connectedProviders.map((provider) => provider.id));
  const workspaceDefaultProvider = workspaceOverrides?.defaultProviderId;
  const defaultProvider =
    workspaceDefaultProvider != null && connectedProviderIds.has(workspaceDefaultProvider)
      ? workspaceDefaultProvider
      : pickDefaultProvider(connectedProviderIds);

  useEffect(() => {
    if (isSimple) {
      return;
    }
    void loadSetting(settingKey).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [isSimple, settingKey, loadSetting]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [busy, onClose]);

  const onPickIssue = (candidate: IssueCandidate) => {
    setIssue(candidate);
    setGoal(candidate.goal);
    setBranchSlug(candidate.branchSlug);
    setSlugTouched(true);
  };

  useEffect(() => {
    setExistingBranches(EMPTY_LOCAL_BRANCHES);
    setBranchesLoaded(false);
  }, [workspaceId]);

  useEffect(() => {
    if (isSimple || branchMode !== 'existing' || branchesLoaded || !workspace?.rootPath) {
      return;
    }
    setBranchesLoading(true);
    listLocalBranches(workspace.rootPath)
      .then(setExistingBranches)
      .catch(() => setExistingBranches([]))
      .finally(() => {
        setBranchesLoading(false);
        setBranchesLoaded(true);
      });
  }, [branchMode, branchesLoaded, isSimple, workspace?.rootPath]);

  useEffect(() => {
    if (slugTouched) {
      return;
    }
    setBranchSlug(slugifyLive(goal));
  }, [goal, slugTouched]);

  const handleGenerateSlug = () => {
    const trimmed = goal.trim();
    if (trimmed === '' || slugGenerating) {
      return;
    }
    setSlugGenerating(true);
    const taskModel = resolveTaskModel(
      'branch_naming',
      workspaceOverrides?.taskModels,
      defaultProvider,
    );
    generateBranchSlug({
      goal: trimmed,
      ...taskModel,
      fallbackSlug: slugifyLive(trimmed),
      invokeFn: invoke,
      ...(workspace?.rootPath != null && { workingDir: workspace.rootPath }),
    })
      .then((result) => {
        if (result.accepted) {
          setBranchSlug(result.slug);
          setSlugTouched(true);
          return;
        }
        if (!slugTouched) {
          setBranchSlug(result.slug);
        }
        showToast('warning', 'Branch name generation failed, kept the name derived from the goal', {
          context: result.error ?? 'unknown error',
        });
      })
      .finally(() => {
        setSlugGenerating(false);
      });
  };

  const conflict = useBranchConflict(
    !isSimple && branchMode === 'existing' ? existingBranch.trim() || null : null,
    workspace?.rootPath ?? null,
  );
  const conflictSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictWorktreePath = conflict?.kind === 'worktree' ? conflict.path : null;

  const branchReady =
    isSimple ||
    (branchMode === 'new' ? isValidBranchSlug(branchSlug) : existingBranch.trim().length > 0);
  const goalReady = goal.trim().length > 0;
  const canCreate =
    goalReady &&
    branchReady &&
    !busy &&
    !noProviderConnected &&
    conflictSessionId === null &&
    conflictWorktreePath === null;

  const onOpenConflictSession = (id: SessionId) => {
    void setCurrentSession(id);
    onClose();
  };

  const onCreate = async (eraseWorktreePath?: string) => {
    setError(null);
    setBusy(true);
    try {
      if (!isSimple && eraseWorktreePath && workspace?.rootPath) {
        await removeWorktree(workspace.rootPath, eraseWorktreePath);
      }
      const useExisting =
        !isSimple && branchMode === 'existing' && existingBranch.trim().length > 0;
      await createSession({
        workspaceId,
        goal,
        ...(!isSimple
          ? {
              branchPrefix: sanitizePrefix(branchPrefix).trim() || DEFAULT_BRANCH_PREFIX,
              branchSlug: branchSlug.trim() || undefined,
            }
          : {}),
        ...(useExisting ? { existingBranch: existingBranch.trim() } : {}),
        ...(issue
          ? {
              externalTask: {
                provider: issue.provider,
                externalId: issue.externalId,
                identifier: issue.identifier,
                url: issue.url,
                title: issue.title,
              },
            }
          : {}),
        ...(attachments.length > 0 ? { attachmentInputs: attachments.map(toAttachmentInput) } : {}),
        openWorkflowBuilder: setupWorkflow,
      });
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-background motion-safe:animate-studio-in">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden">
        <ScrollFade
          className="max-h-[70vh] overflow-y-auto"
          viewportClassName="px-6 py-5"
          fadeSize={24}
        >
          <div className="flex w-full flex-col gap-8">
            {noProviderConnected ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs"
              >
                <AlertTriangle size={13} aria-hidden className="mt-0.5 shrink-0 text-warning" />
                <div className="flex-1 leading-relaxed text-foreground">
                  No provider is connected. A session needs at least one of{' '}
                  {PROVIDER_ORDER.map((id, i) => (
                    <span key={id}>
                      <span className="font-medium">{PROVIDER_LABELS[id]}</span>
                      {i < PROVIDER_ORDER.length - 1 ? ', ' : ''}
                    </span>
                  ))}{' '}
                  connected to run.
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="ml-1 underline underline-offset-2 hover:text-warning"
                  >
                    Open settings
                  </button>
                  .
                </div>
              </div>
            ) : null}
            {!isSimple && issueSources.length > 0 ? (
              <Section
                icon={<Inbox size={14} aria-hidden className="text-primary" />}
                tone="primary"
                title="Start from an issue"
                subtitle="Pick an issue assigned to you in any connected tracker. The goal and branch below auto-fill from it."
              >
                <IssueSourceField
                  workspaceId={workspaceId}
                  sources={issueSources}
                  value={issue}
                  disabled={busy}
                  onPick={onPickIssue}
                  onClear={() => setIssue(null)}
                />
              </Section>
            ) : null}

            <Section
              icon={<Target size={14} aria-hidden className="text-primary" />}
              tone="primary"
              title="Goal"
              subtitle="What this session should accomplish. Be specific. This is the agent's primary context."
            >
              <Textarea
                value={goal}
                placeholder={
                  isSimple
                    ? 'Prepare a study plan for next week’s exam…'
                    : 'Refactor auth domain to extract token validation into a shared module…'
                }
                onChange={(e) => setGoal(e.target.value)}
                autoGrow
                minRows={4}
                maxRows={12}
                autoFocus
                disabled={busy}
              />
            </Section>

            <Section
              icon={<Paperclip size={14} aria-hidden className="text-primary" />}
              tone="primary"
              title="Attachments"
              subtitle="Images and files the agents can read on demand. Routed to the agents that benefit from each type."
            >
              <div
                ref={composerRef}
                data-drop-composer
                className={cn(
                  'flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3 transition-colors',
                  isDragging ? 'border-primary bg-primary/5' : 'border-border-soft',
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ATTACHMENT_ACCEPT}
                  multiple
                  hidden
                  onChange={onFileInputChange}
                />
                {attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((a) => (
                      <AttachmentChip
                        key={a.id}
                        attachment={a}
                        onRemove={() => removeAttachment(a.id)}
                      />
                    ))}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs transition-colors',
                    busy
                      ? 'cursor-not-allowed text-muted-foreground/40'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <Paperclip size={13} aria-hidden /> Add files
                </button>
              </div>
            </Section>

            {!isSimple ? (
              <Section
                icon={<GitBranch size={14} aria-hidden className="text-success" />}
                tone="success"
                title="Branch"
                subtitle="Each session lives on its own git worktree. Pick a fresh branch or attach to an existing one."
              >
                <div className="flex flex-col gap-2">
                  <BranchModeToggle mode={branchMode} onChange={setBranchMode} disabled={busy} />
                  {branchMode === 'new' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground font-mono">
                        {(sanitizePrefix(branchPrefix) || DEFAULT_BRANCH_PREFIX) + '/'}
                      </span>
                      {slugGenerating ? (
                        <Skeleton className="h-8 flex-1 rounded border border-border" />
                      ) : (
                        <Input
                          value={branchSlug}
                          onChange={(e) => {
                            setBranchSlug(sanitizeBranchSlug(e.target.value));
                            setSlugTouched(true);
                          }}
                          placeholder="branch-slug"
                          className="h-8 flex-1 font-mono text-sm"
                          disabled={busy}
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-label="Branch slug"
                        />
                      )}
                      <button
                        type="button"
                        onClick={handleGenerateSlug}
                        disabled={!goal.trim() || slugGenerating || busy}
                        title="Generate from goal"
                        aria-label="Generate branch name"
                        className={cn(
                          'shrink-0 rounded-md border border-border px-2 py-1.5 text-xs transition-colors',
                          goal.trim() && !slugGenerating && !busy
                            ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            : 'cursor-not-allowed text-muted-foreground/30',
                        )}
                      >
                        <Wand2 size={13} aria-hidden />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      <BranchCombobox
                        branches={existingBranches}
                        value={existingBranch}
                        onChange={setExistingBranch}
                        disabled={busy || branchesLoading}
                        loading={branchesLoading}
                      />
                      {conflictSessionId ? (
                        <p className="text-2xs leading-relaxed text-muted-foreground">
                          This branch is already used by an open session. Open it instead of
                          creating a duplicate.
                        </p>
                      ) : conflictWorktreePath ? (
                        <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-warning">
                          <AlertTriangle size={12} aria-hidden className="mt-0.5 shrink-0" />
                          <span>
                            Checked out in another worktree (
                            <span className="break-all font-mono">{conflictWorktreePath}</span>).
                            Creating erases that worktree and recreates it here.
                          </span>
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </Section>
            ) : null}
          </div>
        </ScrollFade>

        {!isSimple && error && isMissingBaseRefError(error) ? (
          <div className="px-6 pb-2">
            <BaseBranchGuide />
          </div>
        ) : null}

        <Divider />

        <footer className="flex shrink-0 items-center gap-3 px-6 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SetupWorkflowToggle
              checked={setupWorkflow}
              disabled={busy}
              onChange={setSetupWorkflow}
            />
            {error && !isMissingBaseRefError(error) ? (
              <span role="alert" className="inline-flex items-center gap-1 text-xs text-danger">
                <AlertTriangle size={12} aria-hidden />
                {error}
              </span>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {conflictSessionId ? (
            <Button onClick={() => onOpenConflictSession(conflictSessionId)} disabled={busy}>
              Open session
            </Button>
          ) : conflictWorktreePath ? (
            <Button
              variant="danger"
              onClick={() => void onCreate(conflictWorktreePath)}
              disabled={busy || !goalReady}
              className={cn(busy && 'animate-border-pulse')}
            >
              {busy ? 'Working…' : 'Erase worktree & create'}
            </Button>
          ) : (
            <Button
              onClick={() => void onCreate()}
              disabled={!canCreate}
              className={cn(busy && 'animate-border-pulse')}
            >
              {busy ? 'Creating…' : 'Create session'}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
};
