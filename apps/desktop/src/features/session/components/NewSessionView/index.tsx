import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Divider, Input, ScrollFade, Skeleton, Textarea, cn } from '@goodboy/ui';
import { AlertTriangle, GitBranch, Paperclip, Plus, Target, Wand2 } from 'lucide-react';
import type { ProviderId, SessionId, WorkspaceId } from '@goodboy/types';
import { CURSOR_AUTO_MODEL } from '@goodboy/core';
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
import { IssuePicker } from '../../../../features/integrations/linear/IssuePicker';
import { goalFromIssue } from '../../../../features/integrations/linear/goal-from-issue';
import type { LinearIssue } from '../../../../features/integrations/linear/client';
import { OverlayHeader } from '../../../../shared/components/OverlayHeader';
import { BaseBranchGuide } from '../../../../shared/components/BaseBranchGuide';
import { isMissingBaseRefError } from '../../../../shared/lib/errors';

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

const PROVIDER_ORDER: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];

function pickDefaultProvider(connectedIds: ReadonlySet<ProviderId>): ProviderId {
  for (const id of PROVIDER_ORDER) {
    if (connectedIds.has(id)) {
      return id;
    }
  }
  return 'anthropic';
}

type SummarizeTaskResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
};

function getCheapModel(providerId: ProviderId): string {
  switch (providerId) {
    case 'anthropic':
      return 'claude-haiku-4-5';
    case 'cursor':
      return CURSOR_AUTO_MODEL;
    case 'codex':
      return 'gpt-5.4-mini';
    case 'gemini':
      return 'gemini-2.5-flash';
    default: {
      const _exhaustive: never = providerId;
      void _exhaustive;
      return 'claude-haiku-4-5';
    }
  }
}

function getDefaultBinary(providerId: ProviderId): string {
  switch (providerId) {
    case 'anthropic':
      return 'claude';
    case 'cursor':
      return 'cursor-agent';
    case 'codex':
      return 'codex';
    case 'gemini':
      return 'gemini';
    default: {
      const _exhaustive: never = providerId;
      void _exhaustive;
      return 'claude';
    }
  }
}

const SLUG_MAX_LEN = 48;

function slugifyLive(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, SLUG_MAX_LEN)
    .replace(/-+$/, '');
}

function sanitizeBranchSlug(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .slice(0, SLUG_MAX_LEN);
}

function sanitizePrefix(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+/, '')
    .slice(0, 16);
}

const EMPTY_LOCAL_BRANCHES: ReadonlyArray<LocalBranchInfo> = [];

function isValidBranchSlug(slug: string): boolean {
  const s = slug.trim();
  if (!s) {
    return false;
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(s) && !s.includes('..');
}

async function generateBranchSlug(goal: string, providerId: ProviderId): Promise<string> {
  const systemPrompt =
    'You are a branch-name generator. Given a goal, output a kebab-case branch slug in English, max 5 words, descriptive (not first words of goal). Respond with ONLY the slug, nothing else.';
  const userMessage = `Goal: ${goal}`;
  const result = await invoke<SummarizeTaskResult>('summarize_session', {
    args: {
      providerId,
      model: getCheapModel(providerId),
      binary: getDefaultBinary(providerId),
      userMessage,
      systemPrompt,
    },
  });
  if ((result.exitCode ?? 0) !== 0) {
    throw new Error(`branch generation failed: ${result.stderr}`);
  }
  const raw = result.stdout.trim();
  let text = raw;
  try {
    const parsed = JSON.parse(raw) as { result?: string };
    if (typeof parsed.result === 'string') {
      text = parsed.result;
    }
  } catch {
    text = raw;
  }
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-')
    .filter(Boolean)
    .slice(0, 5)
    .join('-');
}

export const NewSessionView = ({ onClose, workspaceId, onOpenSettings }: Props) => {
  const createSession = useAppStore((s) => s.createSession);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const providers = useAppStore((s) => s.providers);
  const { showToast } = useToast();
  const settingKey = settingBranchPrefix(workspaceId);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId));

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
  const [linearIssue, setLinearIssue] = useState<LinearIssue | null>(null);

  const {
    attachments,
    isDragging,
    composerRef,
    fileInputRef,
    onFileInputChange,
    removeAttachment,
  } = usePendingAttachments({ showToast });

  const hasLinear = useAppStore((s) =>
    (s.workspaceIntegrations?.[workspaceId] ?? []).some((i) => i.provider === 'linear'),
  );

  const connectedProviders = providers.filter((p) => p.connection === 'connected');
  const noProviderConnected = providers.length > 0 && connectedProviders.length === 0;
  const defaultProvider = pickDefaultProvider(new Set(connectedProviders.map((p) => p.id)));

  useEffect(() => {
    void loadSetting(settingKey).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [settingKey, loadSetting]);

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

  const onPickLinearIssue = (issue: LinearIssue) => {
    setLinearIssue(issue);
    setGoal(goalFromIssue(issue));
    setSlugTouched(false);
  };

  useEffect(() => {
    setExistingBranches(EMPTY_LOCAL_BRANCHES);
    setBranchesLoaded(false);
  }, [workspaceId]);

  useEffect(() => {
    if (branchMode !== 'existing' || branchesLoaded || !workspace?.rootPath) {
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
  }, [branchMode, branchesLoaded, workspace?.rootPath]);

  useEffect(() => {
    if (slugTouched) {
      return;
    }
    setBranchSlug(slugifyLive(goal));
  }, [goal, slugTouched]);

  const handleGenerateSlug = () => {
    const trimmed = goal.trim();
    if (!trimmed || slugGenerating) {
      return;
    }
    setSlugGenerating(true);
    generateBranchSlug(trimmed, defaultProvider)
      .then((slug) => {
        setBranchSlug(slug);
        setSlugTouched(true);
      })
      .catch(() => undefined)
      .finally(() => {
        setSlugGenerating(false);
      });
  };

  const conflict = useBranchConflict(
    branchMode === 'existing' ? existingBranch.trim() || null : null,
    workspace?.rootPath ?? null,
  );
  const conflictSessionId = conflict?.kind === 'session' ? conflict.sessionId : null;
  const conflictWorktreePath = conflict?.kind === 'worktree' ? conflict.path : null;

  const branchReady =
    branchMode === 'new' ? isValidBranchSlug(branchSlug) : existingBranch.trim().length > 0;
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
      if (eraseWorktreePath && workspace?.rootPath) {
        await removeWorktree(workspace.rootPath, eraseWorktreePath);
      }
      const useExisting = branchMode === 'existing' && existingBranch.trim().length > 0;
      await createSession({
        workspaceId,
        goal,
        branchPrefix: sanitizePrefix(branchPrefix).trim() || DEFAULT_BRANCH_PREFIX,
        branchSlug: branchSlug.trim() || undefined,
        ...(useExisting ? { existingBranch: existingBranch.trim() } : {}),
        ...(linearIssue
          ? {
              externalTask: {
                provider: 'linear' as const,
                externalId: linearIssue.id,
                identifier: linearIssue.identifier,
                url: linearIssue.url,
                title: linearIssue.title,
              },
            }
          : {}),
        ...(attachments.length > 0 ? { attachmentInputs: attachments.map(toAttachmentInput) } : {}),
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
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <OverlayHeader
          icon={Plus}
          title="New session"
          subtitle={workspace ? `in: ${workspace.name}` : 'creates a worktree on a fresh branch'}
          onClose={onClose}
          closeLabel="cancel new session"
          closeDisabled={busy}
        />
        <Divider />

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
            {hasLinear ? (
              <Section
                icon={
                  <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-provider-linear text-[9px] font-bold text-white">
                    L
                  </span>
                }
                tone="primary"
                title="Linear issue"
                subtitle="Pick an issue assigned to you. The goal below auto-fills from its title and description."
              >
                <IssuePicker
                  workspaceId={workspaceId}
                  value={linearIssue}
                  onPick={onPickLinearIssue}
                  onClear={() => setLinearIssue(null)}
                  disabled={busy}
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
                placeholder="Refactor auth domain to extract token validation into a shared module…"
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
                        This branch is already used by an open session. Open it instead of creating
                        a duplicate.
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
          </div>
        </ScrollFade>

        {error && isMissingBaseRefError(error) ? (
          <div className="px-6 pb-2">
            <BaseBranchGuide />
          </div>
        ) : null}

        <Divider />

        <footer className="flex shrink-0 items-center gap-3 px-6 py-3">
          <div className="flex-1">
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

type Tone = 'primary' | 'success';

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10',
  success: 'bg-success/10',
};

function Section({
  icon,
  tone,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  tone: Tone;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-start gap-2">
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            TONE_BG[tone],
          )}
        >
          {icon}
        </span>
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-2xs leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function BranchModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: 'new' | 'existing';
  onChange: (next: 'new' | 'existing') => void;
  disabled: boolean;
}) {
  const modes: ReadonlyArray<{ id: 'new' | 'existing'; label: string }> = [
    { id: 'new', label: 'New' },
    { id: 'existing', label: 'Existing' },
  ];
  return (
    <div
      role="tablist"
      aria-label="branch source"
      className="inline-flex shrink-0 rounded border border-border bg-background p-0.5"
    >
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(m.id)}
            className={cn(
              'rounded px-2 py-0.5 text-2xs font-medium motion-safe:transition-colors',
              active
                ? 'bg-muted text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
