import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@goodboy/ui';
import { GitBranch, Loader2, Target, Wand2 } from 'lucide-react';
import type { ProviderId, WorkspaceId } from '@goodboy/types';
import { settingBranchPrefix, DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { listLocalBranches, type LocalBranchInfo } from '../../../../features/worktree/worktree';
import { BranchCombobox } from '../../../../features/worktree/BranchCombobox';
import { IssuePicker } from '../../../../features/integrations/linear/IssuePicker';
import { goalFromIssue } from '../../../../features/integrations/linear/goal-from-issue';
import type { LinearIssue } from '../../../../features/integrations/linear/client';

interface NewSessionDialogProps {
  open: boolean;
  onClose: () => void;
  workspaceId: WorkspaceId;
  onOpenSettings: () => void;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const maybe = err as { message?: unknown };
    if (typeof maybe.message === 'string') return maybe.message;
    try {
      return JSON.stringify(err);
    } catch {
      return 'unknown error';
    }
  }
  return String(err);
}

const PROVIDER_ORDER: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

function pickDefaultProvider(connectedIds: ReadonlySet<ProviderId>): ProviderId {
  for (const id of PROVIDER_ORDER) {
    if (connectedIds.has(id)) return id;
  }
  return 'anthropic';
}

interface SummarizeTaskResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
}

function getCheapModel(providerId: ProviderId): string {
  switch (providerId) {
    case 'anthropic':
      return 'claude-haiku-4-5';
    case 'cursor':
      return 'composer-2-fast';
    case 'codex':
      return 'gpt-5.4-mini';
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

// Live sanitizer for the hand-typed branch slug. Unlike slugifyLive (which
// derives a slug from the prose goal) this preserves the user's casing, an
// uppercase branch stays uppercase. Any run of spaces or disallowed chars
// collapses to a single dash so e.g. ten spaces yield one dash.
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
  if (!s) return false;
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
    if (typeof parsed.result === 'string') text = parsed.result;
  } catch {
    // not json, use raw
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

export function NewSessionDialog({ open, onClose, workspaceId }: NewSessionDialogProps) {
  const createSession = useAppStore((s) => s.createSession);
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

  // Hide the issue picker entirely on workspaces without a Linear integration.
  // Defensive read: tests mock the store with a shallow shape that may not
  // include the integrations slot.
  const hasLinear = useAppStore((s) =>
    (s.workspaceIntegrations?.[workspaceId] ?? []).some((i) => i.provider === 'linear'),
  );

  const defaultProvider = pickDefaultProvider(
    new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
  );

  useEffect(() => {
    if (!open) return;
    setGoal('');
    setBranchSlug('');
    setSlugTouched(false);
    setSlugGenerating(false);
    setBranchMode('new');
    setExistingBranch('');
    setError(null);
    setBusy(false);
    setLinearIssue(null);
    void loadSetting(settingKey).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
  }, [open, settingKey, loadSetting, workspaceId]);

  const onPickLinearIssue = (issue: LinearIssue) => {
    setLinearIssue(issue);
    setGoal(goalFromIssue(issue));
    setSlugTouched(false);
  };

  // Drop the cached branch list when the workspace changes (different repo →
  // different branches). Reuse the cache across reopens of the same workspace.
  useEffect(() => {
    setExistingBranches(EMPTY_LOCAL_BRANCHES);
    setBranchesLoaded(false);
  }, [workspaceId]);

  useEffect(() => {
    if (!open || branchMode !== 'existing' || branchesLoaded || !workspace?.rootPath) return;
    setBranchesLoading(true);
    listLocalBranches(workspace.rootPath)
      .then(setExistingBranches)
      .catch(() => setExistingBranches([]))
      .finally(() => {
        setBranchesLoading(false);
        setBranchesLoaded(true);
      });
  }, [open, branchMode, branchesLoaded, workspace?.rootPath]);

  useEffect(() => {
    if (slugTouched) return;
    setBranchSlug(slugifyLive(goal));
  }, [goal, slugTouched]);

  const handleGenerateSlug = () => {
    const trimmed = goal.trim();
    if (!trimmed || slugGenerating) return;
    setSlugGenerating(true);
    generateBranchSlug(trimmed, defaultProvider)
      .then((slug) => {
        setBranchSlug(slug);
        setSlugTouched(true);
      })
      .catch(() => {
        // silent, user can type manually
      })
      .finally(() => {
        setSlugGenerating(false);
      });
  };

  const branchReady =
    branchMode === 'new' ? isValidBranchSlug(branchSlug) : existingBranch.trim().length > 0;
  const goalReady = goal.trim().length > 0;
  const canCreate = goalReady && branchReady && !busy;

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const useExisting = branchMode === 'existing' && existingBranch.trim().length > 0;
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: sanitizePrefix(branchPrefix).trim() || DEFAULT_BRANCH_PREFIX,
        branchSlug: branchSlug.trim() || undefined,
        ...(useExisting ? { existingBranch: existingBranch.trim() } : {}),
        ...(linearIssue
          ? {
              linearIssue: {
                externalId: linearIssue.id,
                identifier: linearIssue.identifier,
                url: linearIssue.url,
                title: linearIssue.title,
              },
            }
          : {}),
      });
      showToast('success', `session created: ${session.goal}`);
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New session"
      description="Creates a worktree on a fresh branch. Configure workflow and agents from the session panel afterwards."
      size="lg"
      footer={
        <div className="flex w-full items-center gap-2">
          <div className="flex-1 text-xs text-danger">{error ?? ''}</div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void onCreate()} disabled={!canCreate}>
            {busy ? (
              <>
                <Loader2 size={13} className="mr-1.5 animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              'Create session'
            )}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        {hasLinear ? (
          <Section
            icon={
              <span className="flex h-4 w-4 items-center justify-center rounded-sm bg-[#5e6ad2] text-[9px] font-bold text-white">
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
          subtitle="What this session should accomplish. Be specific, agents lean on it for context."
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
          icon={<GitBranch size={14} aria-hidden className="text-success" />}
          tone="success"
          title="Branch"
          subtitle="Each session lives on its own git worktree. Pick a fresh branch or attach to an existing one."
        >
          <div className="flex flex-col gap-2.5">
            <BranchModeToggle mode={branchMode} onChange={setBranchMode} disabled={busy} />
            {branchMode === 'new' ? (
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-xs text-muted-foreground font-mono">
                  {(sanitizePrefix(branchPrefix) || DEFAULT_BRANCH_PREFIX) + '/'}
                </span>
                {slugGenerating ? (
                  <span className="flex h-8 flex-1 animate-pulse items-center rounded border border-border bg-subtle px-2">
                    <span className="h-2 w-full rounded bg-muted-foreground/20" />
                  </span>
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
              <BranchCombobox
                branches={existingBranches}
                value={existingBranch}
                onChange={setExistingBranch}
                disabled={busy || branchesLoading}
                loading={branchesLoading}
                openDirection="up"
              />
            )}
          </div>
        </Section>
      </div>
    </Dialog>
  );
}

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
    <section className="flex flex-col gap-2.5">
      <header className="flex items-start gap-2.5">
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
      <div>{children}</div>
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
