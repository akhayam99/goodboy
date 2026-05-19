import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@kay-am/ui';
import { Loader2, Wand2 } from 'lucide-react';
import type { ProviderId, WorkspaceId } from '@kay-am/types';
import { settingBranchPrefix, DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { useAppStore } from '../../../../store';
import { useToast } from '../../../../app/components/Toast';
import { listLocalBranches, type LocalBranchInfo } from '../../../../features/worktree/worktree';
import { BranchCombobox } from '../../../../features/worktree/BranchCombobox';

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

function sanitizePrefix(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/^-+/, '')
    .slice(0, 16);
}

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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    void loadSetting(settingKey).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
    if (workspace?.rootPath) {
      setBranchesLoading(true);
      listLocalBranches(workspace.rootPath)
        .then(setExistingBranches)
        .catch(() => setExistingBranches([]))
        .finally(() => setBranchesLoading(false));
    }
  }, [open, settingKey, loadSetting, workspaceId, workspace?.rootPath]);

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
        // silent — user can type manually
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
      size="md"
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
      <div className="flex flex-col gap-4">
        <Field label="Goal" hint="What this session should accomplish.">
          <Textarea
            value={goal}
            placeholder="Refactor auth domain"
            onChange={(e) => setGoal(e.target.value)}
            autoGrow
            minRows={4}
            maxRows={12}
            autoFocus
            disabled={busy}
          />
        </Field>
        <Field label="Branch" hint="Worktree branch for this session.">
          <div className="flex flex-col gap-2">
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
                      setBranchSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                    placeholder="branch-slug"
                    className="h-8 flex-1 font-mono text-sm"
                    disabled={busy}
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
              />
            )}
          </div>
        </Field>
      </div>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {hint ? <p className="text-2xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
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
      className="inline-flex shrink-0 rounded border border-border bg-subtle p-0.5"
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
              'rounded px-1.5 py-0.5 text-2xs font-medium motion-safe:transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
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
