import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@kay-am/ui';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  DollarSign,
  Layers,
  Loader2,
  Sparkles,
  Terminal,
  Wand2,
  Target,
  Zap,
  X,
} from 'lucide-react';
import type {
  Workflow,
  WorkflowId,
  ProviderId,
  SessionId,
  SessionProviderPreference,
  WorkspaceId,
} from '@kay-am/types';
import { PROVIDER_CAPABILITIES, getDefaultTurnModel } from '@kay-am/core';
import { shortModel } from '../../../../features/session/agent-row-format';
import {
  AGENT_KIND_META,
  AGENT_KIND_ORDER,
  AGENT_KIND_PALETTE,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../../features/session/agent-kind';
import { PROVIDER_LABEL_LOWER } from '../../../../features/providers/providers';
import {
  type EffortLevel,
  type VerbosityLevel,
  modelEffortLevels,
  InlineField,
  ModelSelect,
  EffortSelect,
  VerbositySelect,
} from '../config-selects';
import { settingBranchPrefix, DEFAULT_BRANCH_PREFIX } from '../../../../features/settings/settings';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { PlannerWidget } from '../../../../features/plans/components/PlannerWidget';
import { fetchGithubIssue, parseGithubIssueUrl } from '../../../../features/github/github';

interface IssueData {
  readonly title: string;
  readonly body: string;
}
import { useToast } from '../../../../app/components/Toast';
import { parseCap } from '../../../../shared/lib/parse-cap';
import { listLocalBranches, type LocalBranchInfo } from '../../../../features/worktree/worktree';

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
  beta?: boolean;
}> = [
  {
    id: 'one-off',
    label: 'One-off',
    hint: 'Single chat session. Spawn agents manually as needed.',
  },
  {
    id: 'preset',
    label: 'Preset',
    hint: 'Pick a saved workflow blueprint. Each step spawns its own agent.',
    beta: true,
  },
  {
    id: 'custom',
    label: 'Custom',
    hint: 'Design a fresh workflow with the planner, then run it.',
    beta: true,
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

async function generateGoalFromIssue(issue: IssueData, providerId: ProviderId): Promise<string> {
  const systemPrompt =
    'You are a goal extractor for AI coding sessions. Given a task or issue, write a concise goal in 2-4 sentences, imperative form (e.g. "Refactor the auth middleware to..."). Output ONLY the goal text, nothing else.';
  const userMessage = `Title: ${issue.title}\n\nDescription:\n${issue.body}`.slice(0, 4000);
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
  const loadInitScript = useAppStore((s) => s.loadInitScript);
  const workspaceInitScript = useAppStore((s) => s.workspaceInitScripts?.[workspaceId] ?? null);

  const [goal, setGoal] = useState('');
  const [issueUrl, setIssueUrl] = useState('');
  const [issueFetching, setIssueFetching] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  const [branchSlug, setBranchSlug] = useState('');
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [slugGenerating, setSlugGenerating] = useState(false);
  const [branchMode, setBranchMode] = useState<'new' | 'existing'>('new');
  const [existingBranches, setExistingBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [existingBranch, setExistingBranch] = useState<string>('');
  const [branchesLoading, setBranchesLoading] = useState(false);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId));

  const [softCapRaw, setSoftCapRaw] = useState('');
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('one-off');
  const [presetTemplateId, setPresetTemplateId] = useState<WorkflowId | ''>('');
  const [customTemplateId, setCustomTemplateId] = useState<WorkflowId | ''>('');
  const selectedPhaseTemplateId =
    workflowMode === 'preset'
      ? presetTemplateId
      : workflowMode === 'custom'
        ? customTemplateId
        : '';
  const setSelectedPhaseTemplateId =
    workflowMode === 'preset' ? setPresetTemplateId : setCustomTemplateId;
  const [firstAgentKind, setFirstAgentKind] = useState<AgentKind>('generic');
  const [autoRun, setAutoRun] = useState(false);
  const [effort, setEffort] = useState<EffortLevel>('medium');
  const [verbosity, setVerbosity] = useState<VerbosityLevel>('normal');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [hasCustomPlan, setHasCustomPlan] = useState(false);
  const [pendingProviderSwitch, setPendingProviderSwitch] = useState<ProviderId | null>(null);
  const [initEnabled, setInitEnabled] = useState(true);
  const [initContent, setInitContent] = useState('');

  const [selectedProvider, setSelectedProvider] = useState<ProviderId>(() => {
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    return pickDefaultProvider(ids);
  });

  const requestProviderChange = (nextProvider: ProviderId) => {
    if (nextProvider === selectedProvider) return;
    if (hasCustomPlan || customTemplateId !== '' || presetTemplateId !== '') {
      setPendingProviderSwitch(nextProvider);
    } else {
      setSelectedProvider(nextProvider);
    }
  };

  const confirmProviderSwitch = () => {
    if (!pendingProviderSwitch) return;
    setSelectedProvider(pendingProviderSwitch);
    setPresetTemplateId('');
    setCustomTemplateId('');
    setHasCustomPlan(false);
    setPendingProviderSwitch(null);
  };
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    getDefaultTurnModel(
      pickDefaultProvider(
        new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id)),
      ),
    ),
  );

  useEffect(() => {
    setSelectedModel(getDefaultTurnModel(selectedProvider));
  }, [selectedProvider]);

  useEffect(() => {
    const levels = modelEffortLevels(selectedModel);
    if (levels && !levels.includes(effort)) {
      setEffort(levels.includes('medium') ? 'medium' : levels[0]!);
    }
  }, [selectedModel, effort]);

  useEffect(() => {
    if (!open) return;
    setGoal('');
    setIssueUrl('');
    setIssueFetching(false);
    setIssueError(null);
    setBranchSlug('');
    setSlugGenerating(false);
    setBranchMode('new');
    setExistingBranch('');
    setSoftCapRaw('');
    setPresetTemplateId('');
    setCustomTemplateId('');
    setHasCustomPlan(false);
    setFirstAgentKind('generic');
    setWorkflowMode('one-off');
    setAutoRun(false);
    setEffort('medium');
    setVerbosity('normal');
    setError(null);
    setInitEnabled(true);
    setInitContent('');
    void loadSetting(settingKey).then((value) => {
      setBranchPrefix(value ?? DEFAULT_BRANCH_PREFIX);
    });
    if (WORKSPACE_FEATURES.initScript && loadInitScript) {
      void loadInitScript(workspaceId);
    }
    const ids = new Set(providers.filter((p) => p.connection === 'connected').map((p) => p.id));
    const provider = pickDefaultProvider(ids);
    setSelectedProvider(provider);
    setSelectedModel(getDefaultTurnModel(provider));
    if (workspace?.rootPath) {
      setBranchesLoading(true);
      listLocalBranches(workspace.rootPath)
        .then(setExistingBranches)
        .catch(() => setExistingBranches([]))
        .finally(() => setBranchesLoading(false));
    }
  }, [open, settingKey, loadSetting, providers, workspaceId, workspace?.rootPath, loadInitScript]);

  useEffect(() => {
    if (open && workspaceInitScript) setInitContent(workspaceInitScript);
  }, [open, workspaceInitScript]);

  const handleGenerateSlug = () => {
    const trimmed = goal.trim();
    if (!trimmed || slugGenerating) return;
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
  };

  const handleIssueUrl = async (value: string) => {
    setIssueUrl(value);
    setIssueError(null);

    const githubParsed = parseGithubIssueUrl(value);
    if (!githubParsed) return;

    setIssueFetching(true);
    try {
      const gh = await fetchGithubIssue(githubParsed.repoSlug, githubParsed.number);
      const goal = await generateGoalFromIssue(
        { title: gh.title, body: gh.body },
        selectedProvider,
      );
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
    setPresetTemplateId('');
    setCustomTemplateId('');
    setHasCustomPlan(false);
    setFirstAgentKind('generic');
    setWorkflowMode('one-off');
    setAutoRun(false);
    setEffort('medium');
    setVerbosity('normal');
    setInitEnabled(true);
    setInitContent('');
    setError(null);
  };

  const onCreate = async () => {
    setError(null);
    setBusy(true);
    try {
      const providerPreference: SessionProviderPreference = {
        defaultProvider: selectedProvider,
        defaultModel: selectedModel,
        allowTurnOverride: true,
      };
      const hasWorkflow = selectedPhaseTemplateId !== '';
      const useExisting = branchMode === 'existing' && existingBranch.trim().length > 0;
      const { session } = await createSession({
        workspaceId,
        goal,
        branchPrefix: branchPrefix.trim() || DEFAULT_BRANCH_PREFIX,
        branchSlug: branchSlug.trim() || undefined,
        ...(useExisting ? { existingBranch: existingBranch.trim() } : {}),
        providerPreference,
        ...(hasWorkflow ? { workflowId: selectedPhaseTemplateId as WorkflowId } : {}),
        ...(hasWorkflow && autoRun ? { autoRun: true } : {}),
        ...(!hasWorkflow ? { firstAgentKind, firstAgentModel: selectedModel } : {}),
        ...(!initEnabled ? { skipInit: true } : {}),
        ...(initContent !== (workspaceInitScript ?? '')
          ? { initContentOverride: initContent }
          : {}),
      });
      const parsedCap = parseCap(softCapRaw);
      if (parsedCap !== null) {
        await setSessionBudget(session.id as SessionId, parsedCap);
      }
      try {
        localStorage.setItem(`${STORAGE_PREFIXES.effort}${session.id}`, effort);
        localStorage.setItem(`${STORAGE_PREFIXES.verbosity}${session.id}`, verbosity);
      } catch {
        // localStorage unavailable
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

  type SectionId = 'goal' | 'budget' | 'workflow' | 'provider' | 'init';
  const [activeSection, setActiveSection] = useState<SectionId>('goal');

  const branchReady =
    branchMode === 'new' ? isValidBranchSlug(branchSlug) : existingBranch.trim().length > 0;
  const goalReady = goal.trim().length > 0 && branchReady;
  const budgetReady = softCapRaw.trim().length > 0;
  const workflowReady =
    workflowMode === 'one-off' ||
    selectedPhaseTemplateId !== '' ||
    (workflowMode === 'custom' && hasCustomPlan);
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
      id: 'provider',
      label: 'Provider',
      icon: <Zap size={13} aria-hidden />,
      ready: providerReady,
      required: true,
    },
    {
      id: 'workflow',
      label: 'Workflow',
      icon: <Layers size={13} aria-hidden />,
      ready: workflowReady,
      required: true,
    },
    ...(WORKSPACE_FEATURES.initScript && workspaceInitScript
      ? [
          {
            id: 'init' as const,
            label: 'Init',
            icon: <Terminal size={13} aria-hidden />,
            ready: initEnabled,
            required: false,
          },
        ]
      : []),
    ...(SESSION_FEATURES.budget
      ? [
          {
            id: 'budget' as const,
            label: 'Budget',
            icon: <DollarSign size={13} aria-hidden />,
            ready: budgetReady,
            required: false,
          },
        ]
      : []),
  ];

  const onWorkflowModeChange = (next: WorkflowMode) => {
    setWorkflowMode(next);
  };

  const missingRequired = sections.filter((s) => s.required && !s.ready);
  const canCreate = missingRequired.length === 0 && !busy;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New session"
      description="Creates a worktree on a fresh branch from the workspace root."
      size="xl"
      fixedHeightClass="h-[640px]"
      footer={
        <div className="flex w-full items-center gap-2">
          <div className="flex-1">
            {error ? (
              <span className="text-xs text-danger">{error}</span>
            ) : missingRequired.length > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs text-warning">
                <AlertTriangle size={12} aria-hidden />
                Complete: {missingRequired.map((s) => s.label).join(', ')}
              </span>
            ) : null}
          </div>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void onCreate()}
            disabled={!canCreate}
            title={
              missingRequired.length > 0
                ? `Complete: ${missingRequired.map((s) => s.label).join(', ')}`
                : undefined
            }
          >
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

        <div className="min-w-0 flex-1 overflow-y-auto pl-4 pr-2">
          <div className={activeSection === 'goal' ? '' : 'hidden'}>
            <div className="flex flex-col gap-4">
              <Field
                label="Issue link"
                labelSuffix={<BetaChip />}
                hint="Paste a GitHub, GitLab, Jira, or Linear issue URL. The goal will be generated automatically."
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
              <Field label="Goal" hint="What this session should accomplish.">
                {issueFetching ? (
                  <div className="flex flex-col gap-2 rounded-md border border-border-soft bg-subtle px-3 py-3">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted-foreground/20" />
                    <div className="h-3 w-full animate-pulse rounded bg-muted-foreground/20" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-muted-foreground/20" />
                  </div>
                ) : (
                  <Textarea
                    value={goal}
                    placeholder="Refactor auth domain"
                    onChange={(e) => setGoal(e.target.value)}
                    autoGrow
                    minRows={4}
                    maxRows={16}
                    autoFocus
                    disabled={busy}
                  />
                )}
              </Field>
              <Field label="Branch" hint="Worktree branch for this session.">
                <div className="flex flex-col gap-2">
                  <BranchModeToggle mode={branchMode} onChange={setBranchMode} disabled={busy} />
                  {branchMode === 'new' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground font-mono">
                        {branchPrefix.trim() || DEFAULT_BRANCH_PREFIX}/
                      </span>
                      {slugGenerating ? (
                        <span className="flex h-8 flex-1 animate-pulse items-center rounded border border-border bg-subtle px-2">
                          <span className="h-2 w-full rounded bg-muted-foreground/20" />
                        </span>
                      ) : (
                        <Input
                          value={branchSlug}
                          onChange={(e) => setBranchSlug(e.target.value)}
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
          </div>

          <div className={activeSection === 'budget' ? '' : 'hidden'}>
            <Field
              label="Soft cap (USD)"
              hint="Optional spend limit. Session gets flagged when exceeded."
            >
              <Input
                value={softCapRaw}
                onChange={(e) => setSoftCapRaw(e.target.value)}
                placeholder="5.00"
                type="number"
                min="0"
                step="0.01"
                disabled={busy}
              />
            </Field>
          </div>

          <div className={activeSection === 'init' ? '' : 'hidden'}>
            <div className="flex flex-col gap-4">
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border-soft bg-background px-3 py-2 text-xs">
                <input
                  type="checkbox"
                  checked={initEnabled}
                  onChange={(e) => setInitEnabled(e.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium text-foreground">Run init script</span>
                  <span className="text-muted-foreground">
                    Execute workspace setup before agents start.
                  </span>
                </span>
              </label>
              <Field
                label="Script"
                hint="Edit for this session only. Changes won't save to workspace."
              >
                <Textarea
                  value={initContent}
                  onChange={(e) => setInitContent(e.target.value)}
                  className="min-h-[200px] resize-y font-mono text-xs"
                  disabled={!initEnabled || busy}
                  spellCheck={false}
                  autoCorrect="off"
                  autoCapitalize="off"
                  rows={10}
                />
              </Field>
            </div>
          </div>

          <div className={activeSection === 'workflow' ? '' : 'hidden'}>
            <Field label="Workflow" hint={workflowModeHint(workflowMode)}>
              <WorkflowModeSegmented mode={workflowMode} onChange={onWorkflowModeChange} />

              <div className={workflowMode === 'one-off' ? 'mt-3 flex flex-col gap-3' : 'hidden'}>
                <Field
                  label="Agent role"
                  hint="Role for the first agent. Spawn more from the sidebar."
                >
                  <AgentKindSelect
                    value={firstAgentKind}
                    onChange={setFirstAgentKind}
                    disabled={busy}
                  />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <InlineField label="Model">
                    <ModelSelect
                      provider={selectedProvider}
                      value={selectedModel}
                      onChange={setSelectedModel}
                      disabled={busy || !providerReady}
                    />
                  </InlineField>
                  <InlineField label="Effort">
                    <EffortSelect
                      model={selectedModel}
                      value={effort}
                      onChange={setEffort}
                      disabled={busy}
                    />
                  </InlineField>
                  <InlineField label="Verbosity">
                    <VerbositySelect value={verbosity} onChange={setVerbosity} disabled={busy} />
                  </InlineField>
                </div>
              </div>

              <div className={workflowMode === 'preset' ? 'mt-3 flex flex-col gap-3' : 'hidden'}>
                {phaseTemplates.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border-soft bg-subtle px-4 py-6 text-center">
                    <Layers size={20} className="text-muted-foreground/30" aria-hidden />
                    <p className="text-xs font-medium text-muted-foreground">No workflow presets</p>
                    <p className="max-w-[14rem] text-2xs leading-relaxed text-muted-foreground/60">
                      Switch to{' '}
                      <button
                        type="button"
                        onClick={() => onWorkflowModeChange('custom')}
                        className="font-medium text-primary underline-offset-2 hover:underline"
                      >
                        Custom
                      </button>{' '}
                      to design your first workflow.
                    </p>
                  </div>
                ) : (
                  <PresetSelect
                    templates={phaseTemplates}
                    value={selectedPhaseTemplateId}
                    onChange={setSelectedPhaseTemplateId}
                    disabled={busy}
                  />
                )}
                {selectedPhaseTemplateId !== '' ? (
                  <WorkflowPreview
                    template={phaseTemplates.find((t) => t.id === selectedPhaseTemplateId) ?? null}
                  />
                ) : null}
              </div>

              <div className={workflowMode === 'custom' ? 'mt-3 flex flex-col gap-3' : 'hidden'}>
                {customTemplateId !== '' ? (
                  (() => {
                    const customTemplate =
                      phaseTemplates.find((t) => t.id === customTemplateId) ?? null;
                    return (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="flex size-4 items-center justify-center rounded-full bg-success/15">
                            <Check size={10} className="text-success" />
                          </span>
                          <span className="font-medium text-foreground">
                            Workflow ready
                            {customTemplate
                              ? ` · ${customTemplate.steps.length} step${customTemplate.steps.length === 1 ? '' : 's'}`
                              : ''}
                          </span>
                        </div>
                        <WorkflowPreview template={customTemplate} />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCustomTemplateId('')}
                            className="flex items-center gap-1 rounded-md border border-border-soft px-2.5 py-1 text-2xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
                          >
                            <Sparkles size={10} aria-hidden /> Re-design
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <PlannerWidget
                    workspaceId={workspaceId}
                    providerId={selectedProvider}
                    initialTheme={goal}
                    onWorkflowReady={(workflowId) => {
                      setCustomTemplateId(workflowId);
                    }}
                    onPlanChange={setHasCustomPlan}
                  />
                )}
              </div>

              {workflowMode !== 'one-off' && selectedPhaseTemplateId !== '' ? (
                <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-md border border-border-soft bg-background px-3 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={autoRun}
                    onChange={(e) => setAutoRun(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      Run autonomously
                      <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
                        beta
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Auto-spawn each step on completion. Pauses on error or budget exceed.
                    </span>
                  </span>
                </label>
              ) : null}
            </Field>
          </div>

          <div className={activeSection === 'provider' ? '' : 'hidden'}>
            <div className="flex flex-col gap-4">
              <Field label="Provider">
                <div className="flex gap-2">
                  {PROVIDER_ORDER.map((id) => {
                    const connected = connectedProviderIds.has(id);
                    const selected = selectedProvider === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!connected}
                        onClick={() => requestProviderChange(id)}
                        className={cn(
                          'flex flex-1 flex-col items-center gap-1 rounded-md border px-3 py-2.5 text-sm transition-colors',
                          selected && connected
                            ? 'border-primary bg-primary/5 font-medium text-foreground'
                            : connected
                              ? 'border-border-soft bg-subtle text-muted-foreground hover:border-border hover:bg-muted/50'
                              : 'cursor-not-allowed border-border-soft/50 bg-subtle/50 text-muted-foreground/40',
                        )}
                      >
                        <span className="flex items-center gap-1.5">
                          {connected ? (
                            <span
                              className={cn(
                                'size-1.5 rounded-full',
                                selected ? 'bg-success' : 'bg-muted-foreground/40',
                              )}
                            />
                          ) : (
                            <X size={10} className="text-danger/60" aria-hidden />
                          )}
                          {PROVIDER_LABEL_LOWER[id]}
                          {id !== 'anthropic' ? (
                            <span className="rounded bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase leading-none tracking-wide text-warning">
                              beta
                            </span>
                          ) : null}
                        </span>
                        {!connected ? (
                          <span
                            role="button"
                            tabIndex={0}
                            className="text-2xs text-primary/70 underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                              window.dispatchEvent(
                                new CustomEvent('kayam:open-settings', {
                                  detail: { section: 'providers' },
                                }),
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                onClose();
                                window.dispatchEvent(
                                  new CustomEvent('kayam:open-settings', {
                                    detail: { section: 'providers' },
                                  }),
                                );
                              }
                            }}
                          >
                            Connect
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </Field>
              {pendingProviderSwitch ? (
                <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <p className="text-xs font-medium text-foreground">
                      Switching provider will discard your custom workflow.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingProviderSwitch(null)}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={confirmProviderSwitch}>
                        Switch provider
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
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
      {hint ? <p className="text-2xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      {children}
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
        This workflow has no steps yet. Add some via the planner above.
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
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  AGENT_KIND_PALETTE[inferAgentKindFromName(step.name)].bg,
                )}
              />
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
              'flex items-center gap-1 rounded px-3 py-1 text-xs font-medium motion-safe:transition-colors',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {m.label}
            {m.beta ? (
              <span className="rounded-sm bg-warning/20 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-warning">
                beta
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function workflowModeHint(mode: WorkflowMode): string {
  return WORKFLOW_MODES.find((m) => m.id === mode)?.hint ?? '';
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

function BranchCombobox({
  branches,
  value,
  onChange,
  disabled,
  loading,
}: {
  branches: ReadonlyArray<LocalBranchInfo>;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = branches.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));

  const select = useCallback(
    (name: string) => {
      onChange(name);
      setQuery(name);
      setOpen(false);
    },
    [onChange],
  );

  useEffect(() => {
    if (value && !query) setQuery(value);
  }, [value, query]);

  useEffect(() => {
    setHighlightIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightIdx, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (!open) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filtered[highlightIdx]) select(filtered[highlightIdx].name);
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  const placeholder = loading
    ? 'Loading…'
    : branches.length === 0
      ? 'No local branches'
      : 'Search branch…';

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder={placeholder}
        disabled={disabled || branches.length === 0}
        aria-label="Existing branch"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        className="h-7 w-full truncate rounded border border-border bg-background px-2.5 text-sm font-mono motion-safe:transition-colors placeholder:text-muted-foreground/50 hover:border-border-strong focus:outline-none focus:ring-1 focus:ring-primary"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (!e.target.value) onChange('');
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {open && filtered.length > 0 ? (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute bottom-full left-0 z-50 mb-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-subtle py-0.5 shadow-lg"
        >
          {filtered.map((b, i) => (
            <li
              key={b.name}
              role="option"
              aria-selected={highlightIdx === i}
              onMouseEnter={() => setHighlightIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                select(b.name);
              }}
              className={cn(
                'flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm font-mono',
                highlightIdx === i ? 'bg-primary/10 text-foreground' : 'text-muted-foreground',
              )}
            >
              <span className="min-w-0 truncate">{b.name}</span>
              {b.inUse ? <span className="shrink-0 text-2xs text-warning">in use</span> : null}
              {b.hasUncommitted ? (
                <span className="shrink-0 text-2xs text-warning">dirty</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {open && !loading && filtered.length === 0 && query ? (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-full rounded-md border border-border bg-subtle px-2 py-2 text-xs text-muted-foreground shadow-lg">
          No matching branches
        </div>
      ) : null}
    </div>
  );
}

function AgentKindSelect({
  value,
  onChange,
  disabled,
}: {
  value: AgentKind;
  onChange: (kind: AgentKind) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const meta = AGENT_KIND_META[value];
  const palette = AGENT_KIND_PALETTE[value];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span className={cn('size-2 shrink-0 rounded-full', palette.bg)} aria-hidden />
        <span className="shrink-0 font-medium text-foreground">{meta.label}</span>
        <span className="flex-1 truncate text-muted-foreground/70">{meta.hint}</span>
        <ChevronDown
          size={12}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[280px] w-full overflow-y-auto rounded-md border border-border bg-subtle py-0.5 shadow-lg">
          {[...AGENT_KIND_ORDER]
            .filter((k) => k !== 'init')
            .sort((a, b) => AGENT_KIND_META[a].label.localeCompare(AGENT_KIND_META[b].label))
            .map((kind) => {
              const m = AGENT_KIND_META[kind];
              const p = AGENT_KIND_PALETTE[kind];
              const active = value === kind;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    onChange(kind);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors',
                    active
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', p.bg)} aria-hidden />
                  <span
                    className={cn(
                      'shrink-0 font-medium',
                      active ? 'text-foreground' : 'text-foreground/80',
                    )}
                  >
                    {m.label}
                  </span>
                  <span className="flex-1 truncate text-muted-foreground/60">{m.hint}</span>
                  {active ? (
                    <Check size={11} className="shrink-0 text-primary" aria-hidden />
                  ) : null}
                </button>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}

function PresetSelect({
  templates,
  value,
  onChange,
  disabled,
}: {
  templates: ReadonlyArray<Workflow>;
  value: WorkflowId | '';
  onChange: (id: WorkflowId | '') => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = templates.find((t) => t.id === value) ?? null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors',
          open
            ? 'border-primary bg-primary/5'
            : value
              ? 'border-primary/50 bg-primary/5'
              : 'border-border-soft bg-subtle hover:border-border hover:bg-muted/50',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {selected ? (
          <>
            <span className="flex-1 truncate font-medium text-foreground">{selected.name}</span>
            <span className="shrink-0 text-2xs text-muted-foreground">
              {selected.steps.length} step{selected.steps.length === 1 ? '' : 's'}
            </span>
          </>
        ) : (
          <span className="flex-1 text-muted-foreground/60">Select a workflow preset</span>
        )}
        <ChevronDown
          size={12}
          className={cn(
            'shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-[240px] w-full overflow-y-auto rounded-md border border-border bg-subtle py-0.5 shadow-lg">
          {templates.map((t) => {
            const active = value === t.id;
            const sorted = [...t.steps].sort((a, b) => a.ordinal - b.ordinal);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onChange(active ? '' : t.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full flex-col gap-0.5 px-2.5 py-2 text-left transition-colors',
                  active ? 'bg-primary/10' : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex-1 truncate text-xs font-medium',
                      active ? 'text-foreground' : 'text-foreground/80',
                    )}
                  >
                    {t.name}
                  </span>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {t.steps.length} step{t.steps.length === 1 ? '' : 's'}
                  </span>
                  {active ? (
                    <Check size={11} className="shrink-0 text-primary" aria-hidden />
                  ) : null}
                </div>
                {sorted.length > 0 ? (
                  <div className="flex items-center gap-1">
                    {sorted.map((step, i) => {
                      const kind = inferAgentKindFromName(step.name);
                      const pal = AGENT_KIND_PALETTE[kind];
                      return (
                        <span key={step.id} className="flex items-center gap-0.5">
                          {i > 0 ? (
                            <span className="text-2xs text-muted-foreground/30">→</span>
                          ) : null}
                          <span className={cn('max-w-[5rem] truncate text-2xs', pal.fg)}>
                            {step.name}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
