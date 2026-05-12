import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@kay-am/ui';
import {
  AlertTriangle,
  Check,
  DollarSign,
  GitBranch,
  Layers,
  Loader2,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import type {
  Workflow,
  WorkflowId,
  ProviderId,
  TaskId,
  TaskProviderPreference,
  WorkspaceId,
} from '@kay-am/types';
import { shortModel } from '../agentRowFormat';
import { PROVIDER_LABEL_LOWER } from '../providers';
import { settingBranchPrefix, DEFAULT_BRANCH_PREFIX } from '../settings';
import { EMPTY_ARRAY, useAppStore } from '../store';
import { PlannerWidget } from './PlannerWidget';
import { fetchGithubIssue, parseGithubIssueUrl } from '../github';
import { fetchIssueFromUrl, type IssueData } from '../integrations';
import { useToast } from './Toast';

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

type WorkflowMode = 'one-off' | 'preset' | 'custom';

const WORKFLOW_MODES: ReadonlyArray<{
  id: WorkflowMode;
  label: string;
  hint: string;
}> = [
  {
    id: 'one-off',
    label: 'one-off',
    hint: 'single chat — spawn agents manually when you need them.',
  },
  {
    id: 'preset',
    label: 'preset',
    hint: 'pick a saved workflow blueprint. each step pre-spawns its own agent.',
  },
  {
    id: 'custom',
    label: 'custom',
    hint: 'design a fresh workflow with the planner agent, then run it.',
  },
];

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
      return 'claude-haiku-4-5';
    case 'codex':
      return 'o4-mini';
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

async function generateBranchSlug(goal: string, providerId: ProviderId): Promise<string> {
  const systemPrompt =
    'You are a branch-name generator. Given a goal, output a kebab-case branch slug in English, max 5 words, descriptive (not first words of goal). Respond with ONLY the slug, nothing else.';
  const userMessage = `Goal: ${goal}`;
  const result = await invoke<SummarizeTaskResult>('summarize_task', {
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

async function generateGoalFromIssue(issue: IssueData, providerId: ProviderId): Promise<string> {
  const systemPrompt =
    'You are a goal extractor for AI coding sessions. Given a task or issue, write a concise goal in 2-4 sentences, imperative form (e.g. "Refactor the auth middleware to..."). Output ONLY the goal text, nothing else.';
  const userMessage = `Title: ${issue.title}\n\nDescription:\n${issue.body}`.slice(0, 4000);
  const result = await invoke<SummarizeTaskResult>('summarize_task', {
    args: {
      providerId,
      model: getCheapModel(providerId),
      binary: getDefaultBinary(providerId),
      userMessage,
      systemPrompt,
    },
  });
  if ((result.exitCode ?? 0) !== 0) {
    throw new Error(`goal generation failed: ${result.stderr}`);
  }
  const raw = result.stdout.trim();
  try {
    const parsed = JSON.parse(raw) as { result?: string };
    if (typeof parsed.result === 'string') return parsed.result.trim();
  } catch {
    // not json, use raw
  }
  return raw;
}

export function NewSessionDialog({
  open,
  onClose,
  workspaceId,
  onOpenSettings,
}: NewSessionDialogProps) {
  const createSession = useAppStore((s) => s.createSession);
  const loadSetting = useAppStore((s) => s.loadSetting);
  const setSessionBudget = useAppStore((s) => s.setSessionBudget);
  const { showToast } = useToast();
  const providers = useAppStore((s) => s.providers);
  const settingKey = settingBranchPrefix(workspaceId);
  const phaseTemplates = useAppStore((s) => s.phaseTemplates[workspaceId] ?? EMPTY_ARRAY);

  const [goal, setGoal] = useState('');
  const [issueUrl, setIssueUrl] = useState('');
  const [issueFetching, setIssueFetching] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  const [branchSlug, setBranchSlug] = useState('');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [slugGenerating, setSlugGenerating] = useState(false);

  const [softCapRaw, setSoftCapRaw] = useState('');
  const [selectedPhaseTemplateId, setSelectedPhaseTemplateId] = useState<WorkflowId | ''>('');
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('one-off');
  const [autoRun, setAutoRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(() => {
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    return pickDefaultProvider(ids);
  });

  const goalDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSlugGoalRef = useRef('');

  useEffect(() => {
    if (!open) return;
    setGoal('');
    setIssueUrl('');
    setIssueFetching(false);
    setIssueError(null);
    setBranchSlug('');
    setSlugGenerating(false);
    setSoftCapRaw('');
    setSelectedPhaseTemplateId('');
    setWorkflowMode('one-off');
    setAutoRun(false);
    setError(null);
    lastSlugGoalRef.current = '';
    void loadSetting(settingKey).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    setSelectedProvider(pickDefaultProvider(ids));
  }, [open, settingKey, loadSetting, providers, workspaceId]);

  useEffect(() => {
    if (!open) return;
    const trimmed = goal.trim();
    if (!trimmed || trimmed === lastSlugGoalRef.current) return;
    if (goalDebounceRef.current) clearTimeout(goalDebounceRef.current);
    goalDebounceRef.current = setTimeout(() => {
      lastSlugGoalRef.current = trimmed;
      setSlugGenerating(true);
      generateBranchSlug(trimmed, selectedProvider)
        .then((slug) => {
          setBranchSlug(slug);
        })
        .catch(() => {
          // silent — user can type manually
        })
        .finally(() => {
          setSlugGenerating(false);
        });
    }, 800);
    return () => {
      if (goalDebounceRef.current) clearTimeout(goalDebounceRef.current);
    };
  }, [goal, selectedProvider, open]);

  const handleIssueUrl = async (value: string) => {
    setIssueUrl(value);
    setIssueError(null);

    const githubParsed = parseGithubIssueUrl(value);
    const hasMatch =
      githubParsed !== null ||
      value.includes('linear.app') ||
      value.includes('gitlab.com') ||
      value.includes('atlassian.net');
    if (!hasMatch) return;

    setIssueFetching(true);
    try {
      let issueData: IssueData | null = null;
      if (githubParsed) {
        const gh = await fetchGithubIssue(githubParsed.repoSlug, githubParsed.number);
        issueData = { service: 'github', title: gh.title, body: gh.body, url: gh.url };
      } else {
        issueData = await fetchIssueFromUrl(value);
      }
      if (!issueData) return;
      const goal = await generateGoalFromIssue(issueData, selectedProvider);
      setGoal(goal);
    } catch (err) {
      setIssueError(formatError(err));
    } finally {
      setIssueFetching(false);
    }
  };

  const reset = () => {
    setGoal('');
    setIssueUrl('');
    setIssueFetching(false);
    setIssueError(null);
    setBranchSlug('');
    setSlugGenerating(false);
    setSoftCapRaw('');
    setSelectedPhaseTemplateId('');
    setWorkflowMode('one-off');
    setAutoRun(false);
    setError(null);
    lastSlugGoalRef.current = '';
  };

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const providerPreference: TaskProviderPreference = {
        defaultProvider: selectedProvider,
        allowTurnOverride: true,
      };
      const hasWorkflow = selectedPhaseTemplateId !== '';
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: branchPrefix.trim() || DEFAULT_BRANCH_PREFIX,
        branchSlug: branchSlug.trim() || undefined,
        providerPreference,
        ...(hasWorkflow ? { workflowId: selectedPhaseTemplateId as WorkflowId } : {}),
        ...(hasWorkflow && autoRun ? { autoRun: true } : {}),
      });
      const parsedCap = parseFloat(softCapRaw);
      if (softCapRaw.trim().length > 0 && !isNaN(parsedCap) && parsedCap > 0) {
        await setSessionBudget(session.id as TaskId, parsedCap);
      }
      showToast('success', `session created: ${session.goal}`);
      reset();
      onClose();
    } catch (err) {
      setError(formatError(err));
    } finally {
      setBusy(false);
    }
  };

  const connectedProviderIds = new Set(
    providers.filter((p) => p.connection === 'connected').map((p) => p.id),
  );

  type SectionId = 'goal' | 'budget' | 'workflow' | 'provider';
  const [activeSection, setActiveSection] = useState<SectionId>('goal');

  const goalReady = goal.trim().length > 0;
  const budgetReady = softCapRaw.trim().length > 0;
  const workflowReady = selectedPhaseTemplateId !== '';
  const providerReady = connectedProviderIds.has(selectedProvider);

  const sections: ReadonlyArray<{
    id: SectionId;
    label: string;
    icon: ReactNode;
    ready: boolean;
    required: boolean;
  }> = [
    {
      id: 'goal',
      label: 'Goal',
      icon: <Target size={13} aria-hidden />,
      ready: goalReady,
      required: true,
    },
    {
      id: 'budget',
      label: 'Budget',
      icon: <DollarSign size={13} aria-hidden />,
      ready: budgetReady,
      required: false,
    },
    {
      id: 'workflow',
      label: 'Workflow',
      icon: <Layers size={13} aria-hidden />,
      ready: workflowReady,
      required: false,
    },
    {
      id: 'provider',
      label: 'Provider',
      icon: <Zap size={13} aria-hidden />,
      ready: providerReady,
      required: true,
    },
  ];

  const onWorkflowModeChange = (next: WorkflowMode) => {
    setWorkflowMode(next);
    if (next === 'one-off') {
      setSelectedPhaseTemplateId('');
      setAutoRun(false);
    } else if (next === 'preset' || next === 'custom') {
      setSelectedPhaseTemplateId('');
    }
  };

  const missingRequired = sections.filter((s) => s.required && !s.ready);
  const canCreate = missingRequired.length === 0 && !busy;

  const branchDisplay = `${branchPrefix.trim() || DEFAULT_BRANCH_PREFIX}/${branchSlug.trim() || '…'}`;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New session"
      description="Creates a worktree on a fresh branch from the workspace root."
      size="xl"
      fixedHeightClass="h-[640px]"
      footer={
        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center gap-2">
            <GitBranch size={13} className="shrink-0 text-muted-foreground" aria-hidden />
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <span className="shrink-0 text-xs text-muted-foreground">
                {branchPrefix.trim() || DEFAULT_BRANCH_PREFIX}/
              </span>
              {slugGenerating ? (
                <span className="flex h-6 flex-1 animate-pulse items-center rounded bg-muted px-2">
                  <span className="h-2 w-24 rounded bg-muted-foreground/20" />
                </span>
              ) : (
                <Input
                  value={branchSlug}
                  onChange={(e) => setBranchSlug(e.target.value)}
                  placeholder="branch-slug"
                  className="h-6 min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-xs font-mono focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={busy}
                  aria-label="branch slug"
                />
              )}
            </div>
            {branchSlug.trim() ? (
              <span className="shrink-0 text-2xs text-muted-foreground/60">→ {branchDisplay}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {error ? (
              <span className="mr-auto text-xs text-danger">{error}</span>
            ) : missingRequired.length > 0 ? (
              <span className="mr-auto inline-flex items-center gap-1 text-xs text-warning">
                <AlertTriangle size={12} aria-hidden />
                complete: {missingRequired.map((s) => s.label.toLowerCase()).join(', ')}
              </span>
            ) : null}
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              cancel
            </Button>
            <Button
              onClick={() => void onCreate()}
              disabled={!canCreate}
              title={
                missingRequired.length > 0
                  ? `complete: ${missingRequired.map((s) => s.label.toLowerCase()).join(', ')}`
                  : undefined
              }
            >
              {busy ? (
                <>
                  <Loader2 size={13} className="mr-1.5 animate-spin" aria-hidden />
                  creating…
                </>
              ) : (
                'create session'
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex h-full min-h-0 gap-0">
        <nav className="flex w-40 shrink-0 flex-col gap-0.5 overflow-y-auto pr-2">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id as SectionId)}
              title={s.required && !s.ready ? `${s.label.toLowerCase()} is required` : undefined}
              className={cn(
                'relative flex items-center gap-2 rounded-md py-1.5 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
                activeSection === s.id
                  ? 'bg-muted font-medium text-foreground before:absolute before:left-1 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {s.icon}
              <span className="flex-1">{s.label}</span>
              {s.ready ? (
                <Check size={11} className="text-success" aria-label="filled" />
              ) : s.required ? (
                <AlertTriangle
                  size={11}
                  className="text-warning"
                  aria-label={`${s.label.toLowerCase()} required`}
                />
              ) : null}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto pl-4">
          {activeSection === 'goal' ? (
            <div className="flex flex-col gap-4">
              <Field
                label="issue link"
                labelSuffix={<BetaChip />}
                hint="paste a GitHub, GitLab, Jira, or Linear issue URL — goal will be generated automatically."
              >
                <div className="relative">
                  <Input
                    value={issueUrl}
                    onChange={(e) => void handleIssueUrl(e.target.value)}
                    placeholder="github.com/…/issues/42 · linear.app/…/TEAM-1 · jira · gitlab"
                    disabled={issueFetching || busy}
                  />
                  {issueFetching ? (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <Loader2
                        size={13}
                        className="animate-spin text-muted-foreground"
                        aria-label="fetching issue"
                      />
                    </span>
                  ) : null}
                </div>
                {issueError ? <p className="text-xs text-danger">{issueError}</p> : null}
              </Field>
              <Field label="goal" hint="what the session should accomplish.">
                {issueFetching ? (
                  <div className="flex flex-col gap-2 rounded-md border border-border-soft bg-subtle px-3 py-3">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted-foreground/20" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted-foreground/20" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-muted-foreground/20" />
                  </div>
                ) : (
                  <Textarea
                    value={goal}
                    placeholder="refactor auth domain"
                    onChange={(e) => setGoal(e.target.value)}
                    autoGrow
                    minRows={4}
                    maxRows={16}
                    autoFocus
                    disabled={busy}
                  />
                )}
              </Field>
            </div>
          ) : null}

          {activeSection === 'budget' ? (
            <Field
              label="soft cap (usd)"
              hint="optional spend limit. session is flagged when exceeded."
            >
              <Input
                value={softCapRaw}
                onChange={(e) => setSoftCapRaw(e.target.value)}
                placeholder="e.g. 5.00"
                type="number"
                min="0"
                step="0.01"
                disabled={busy}
              />
            </Field>
          ) : null}

          {activeSection === 'workflow' ? (
            <Field label="workflow (optional)" hint={workflowModeHint(workflowMode)}>
              <WorkflowModeSegmented mode={workflowMode} onChange={onWorkflowModeChange} />

              {workflowMode === 'one-off' ? (
                <div className="mt-3 rounded-md border border-dashed border-border-soft bg-subtle px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                  no workflow attached. you can spawn agents on demand from the chat sidebar.
                </div>
              ) : null}

              {workflowMode === 'preset' ? (
                <div className="mt-3 flex flex-col gap-3">
                  {phaseTemplates.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border-soft bg-subtle px-3 py-4 text-xs leading-relaxed text-muted-foreground">
                      no presets yet — switch to <span className="font-medium">custom</span> and
                      design one with the planner.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {phaseTemplates.map((t) => (
                        <WorkflowChip
                          key={t.id}
                          label={`${t.name.toLowerCase()}${t.steps.length > 0 ? ` · ${t.steps.length}` : ''}`}
                          active={selectedPhaseTemplateId === t.id}
                          onClick={() => setSelectedPhaseTemplateId(t.id)}
                          title={t.description || undefined}
                        />
                      ))}
                    </div>
                  )}
                  {selectedPhaseTemplateId !== '' ? (
                    <WorkflowPreview
                      template={
                        phaseTemplates.find((t) => t.id === selectedPhaseTemplateId) ?? null
                      }
                    />
                  ) : null}
                </div>
              ) : null}

              {workflowMode === 'custom' ? (
                <div className="mt-3 flex flex-col gap-3">
                  {selectedPhaseTemplateId !== '' ? (
                    <>
                      <WorkflowPreview
                        template={
                          phaseTemplates.find((t) => t.id === selectedPhaseTemplateId) ?? null
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedPhaseTemplateId('')}
                        className="flex items-center gap-1 self-start text-2xs text-muted-foreground underline hover:text-foreground"
                      >
                        <Sparkles size={10} aria-hidden /> re-design with planner
                      </button>
                    </>
                  ) : (
                    <div className="rounded-md border border-border-soft bg-subtle px-3 py-3">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Sparkles size={12} aria-hidden /> design with planner
                      </div>
                      <PlannerWidget
                        workspaceId={workspaceId}
                        providerId={selectedProvider}
                        initialTheme={goal}
                        onWorkflowReady={(workflowId) => {
                          setSelectedPhaseTemplateId(workflowId);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {workflowMode !== 'one-off' && selectedPhaseTemplateId !== '' ? (
                <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-md border border-border-soft bg-background px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(e) => setAutoRun(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">run autonomously</span>
                    <span className="text-muted-foreground">
                      auto-spawn each step on completion. pauses on error or budget exceed.
                    </span>
                  </span>
                </label>
              ) : null}
            </Field>
          ) : null}

          {activeSection === 'provider' ? (
            <Field label="provider">
              <ul className="flex flex-col divide-y divide-border-soft overflow-hidden rounded-md border border-border">
                {PROVIDER_ORDER.map((id) => {
                  const connected = connectedProviderIds.has(id);
                  const disabled = !connected;
                  const selected = selectedProvider === id;
                  return (
                    <li
                      key={id}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm motion-safe:transition-colors',
                        disabled ? 'opacity-50' : 'hover:bg-muted/40',
                        selected && !disabled ? 'bg-muted/60' : '',
                      )}
                    >
                      <input
                        type="radio"
                        name="provider"
                        id={`provider-${id}`}
                        value={id}
                        checked={selected}
                        disabled={disabled}
                        onChange={() => setSelectedProvider(id)}
                        className="accent-primary"
                      />
                      <label
                        htmlFor={`provider-${id}`}
                        className={cn(
                          'flex flex-1 items-center justify-between',
                          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                        )}
                      >
                        <span className="font-medium">{PROVIDER_LABEL_LOWER[id]}</span>
                        {!connected && (
                          <button
                            type="button"
                            className="text-xs text-primary underline hover:opacity-80"
                            onClick={() => {
                              onClose();
                              window.dispatchEvent(
                                new CustomEvent('kayam:open-settings', {
                                  detail: { section: 'providers' },
                                }),
                              );
                            }}
                          >
                            connect in settings
                          </button>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Field>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

function Field({
  label,
  labelSuffix,
  hint,
  children,
}: {
  label: string;
  labelSuffix?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        {label}
        {labelSuffix}
      </span>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function BetaChip() {
  return (
    <span className="rounded-sm bg-warning/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
      beta
    </span>
  );
}

function WorkflowPreview({ template }: { template: Workflow | null }) {
  if (!template) return null;
  if (template.steps.length === 0) {
    return (
      <p className="mt-2 rounded-md bg-subtle px-3 py-2 text-xs text-muted-foreground">
        this workflow has no steps yet — add some via the planner above.
      </p>
    );
  }
  const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <div className="mt-2 flex flex-col gap-1.5 rounded-md bg-subtle p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          will spawn {template.steps.length} agent
          {template.steps.length === 1 ? '' : 's'}
        </span>
        {template.description ? (
          <span className="truncate text-2xs text-muted-foreground/70">{template.description}</span>
        ) : null}
      </div>
      <ol className="flex flex-col gap-1">
        {sortedSteps.map((step, i) => {
          const model = step.modelOverride ? shortModel(step.modelOverride) : null;
          const effort = step.effort ?? null;
          const verbosity = step.verbosity ?? null;
          return (
            <li
              key={step.id}
              className="flex items-center gap-2 rounded-md bg-background px-2 py-1 text-xs"
            >
              <span className="font-mono text-2xs text-muted-foreground">{i + 1}.</span>
              <span className="flex-1 truncate font-medium text-foreground">{step.name}</span>
              {model || effort || verbosity ? (
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                  {[model, effort, verbosity ? `v:${verbosity}` : null].filter(Boolean).join(' · ')}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="text-2xs text-muted-foreground/70">
        each agent runs in its own chat thread. you decide which one gets the next turn.
      </p>
    </div>
  );
}

function WorkflowChip({
  label,
  active,
  onClick,
  title,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-full px-2.5 py-1 text-xs motion-safe:transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'bg-subtle text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}

function WorkflowModeSegmented({
  mode,
  onChange,
}: {
  mode: WorkflowMode;
  onChange: (next: WorkflowMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="workflow mode"
      className="inline-flex rounded-md border border-border bg-subtle p-0.5"
    >
      {WORKFLOW_MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              'rounded px-3 py-1 text-xs font-medium motion-safe:transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function workflowModeHint(mode: WorkflowMode): string {
  return WORKFLOW_MODES.find((m) => m.id === mode)?.hint ?? '';
}
