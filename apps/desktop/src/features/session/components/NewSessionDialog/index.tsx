import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Dialog, Input, Textarea, cn } from '@kay-am/ui';
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  DollarSign,
  GitBranch,
  Layers,
  Loader2,
  Sparkles,
  Terminal,
  Target,
  Wand2,
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
import { getDefaultTurnModel } from '@kay-am/core';
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
import { useToast } from '../../../../app/components/Toast';
import { parseCap } from '../../../../shared/lib/parse-cap';
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

type WorkflowMode = 'single' | 'preset' | 'custom';

interface WorkflowModeMeta {
  readonly id: WorkflowMode;
  readonly label: string;
  readonly tagline: string;
  readonly description: string;
  readonly icon: typeof Bot;
  readonly beta?: boolean;
}

const WORKFLOW_MODES: ReadonlyArray<WorkflowModeMeta> = [
  {
    id: 'single',
    label: 'Single agent',
    tagline: 'Solo chat session',
    description:
      'One agent, one conversation. Spawn more agents from the sidebar as the work unfolds.',
    icon: Bot,
  },
  {
    id: 'preset',
    label: 'Workflow preset',
    tagline: 'Run a saved blueprint',
    description: 'Pick a preset workflow. Each step spawns its own agent in order.',
    icon: Layers,
    beta: true,
  },
  {
    id: 'custom',
    label: 'Custom plan',
    tagline: 'Designed for this goal',
    description: 'Let the planner draft a workflow tailored to your goal, then run it.',
    icon: Sparkles,
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

  const [branchSlug, setBranchSlug] = useState('');
  // Tracks whether the user has manually edited the slug. While false, the
  // slug stays linked to the goal (live slugify). Once true, edits no longer
  // overwrite their manual value.
  const [slugTouched, setSlugTouched] = useState(false);
  const [branchPrefix, setBranchPrefix] = useState(DEFAULT_BRANCH_PREFIX);
  const [slugGenerating, setSlugGenerating] = useState(false);
  const [branchMode, setBranchMode] = useState<'new' | 'existing'>('new');
  const [existingBranches, setExistingBranches] = useState<ReadonlyArray<LocalBranchInfo>>([]);
  const [existingBranch, setExistingBranch] = useState<string>('');
  const [branchesLoading, setBranchesLoading] = useState(false);
  const workspace = useAppStore((s) => s.workspaces.find((w) => w.id === workspaceId));

  const [softCapRaw, setSoftCapRaw] = useState('');
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('single');
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
    setBranchSlug('');
    setSlugTouched(false);
    setSlugGenerating(false);
    setBranchMode('new');
    setExistingBranch('');
    setSoftCapRaw('');
    setPresetTemplateId('');
    setCustomTemplateId('');
    setHasCustomPlan(false);
    setFirstAgentKind('generic');
    setWorkflowMode('single');
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

  // Live slug derivation from goal while the user hasn't manually edited it.
  useEffect(() => {
    if (slugTouched) return;
    setBranchSlug(slugifyLive(goal));
  }, [goal, slugTouched]);

  const handleGenerateSlug = () => {
    const trimmed = goal.trim();
    if (!trimmed || slugGenerating) return;
    setSlugGenerating(true);
    generateBranchSlug(trimmed, selectedProvider)
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

  const reset = () => {
    setGoal('');
    setBranchSlug('');
    setSlugTouched(false);
    setSlugGenerating(false);
    setSoftCapRaw('');
    setPresetTemplateId('');
    setCustomTemplateId('');
    setHasCustomPlan(false);
    setFirstAgentKind('generic');
    setWorkflowMode('single');
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
    workflowMode === 'single' ||
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
      className="w-[68rem] max-w-[95vw]"
      fixedHeightClass="h-[680px]"
      bodyClassName="px-0 py-0 gap-0"
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
      <div className="flex h-full min-h-0">
        {/* Fixed ladder — never scrolls */}
        <nav className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-border-soft bg-subtle/40 px-3 py-5">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id as SectionId)}
              title={s.required && !s.ready ? `${s.label.toLowerCase()} is required` : undefined}
              className={cn(
                'relative flex items-center gap-2 rounded-md py-2 pl-3 pr-2 text-left text-sm motion-safe:transition-colors',
                activeSection === s.id
                  ? 'bg-background font-medium text-foreground shadow-sm before:absolute before:left-1 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full before:bg-primary'
                  : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
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

        {/* Only this column scrolls */}
        <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
          {activeSection === 'goal' ? (
            <GoalSection
              goal={goal}
              setGoal={setGoal}
              branchSlug={branchSlug}
              setBranchSlug={(v) => {
                setBranchSlug(v);
                setSlugTouched(true);
              }}
              slugGenerating={slugGenerating}
              branchPrefix={branchPrefix}
              setBranchPrefix={setBranchPrefix}
              branchMode={branchMode}
              setBranchMode={setBranchMode}
              existingBranches={existingBranches}
              existingBranch={existingBranch}
              setExistingBranch={setExistingBranch}
              branchesLoading={branchesLoading}
              busy={busy}
              onGenerateSlug={handleGenerateSlug}
            />
          ) : null}

          {activeSection === 'workflow' ? (
            <WorkflowSection
              workflowMode={workflowMode}
              onModeChange={onWorkflowModeChange}
              phaseTemplates={phaseTemplates}
              selectedPhaseTemplateId={selectedPhaseTemplateId}
              setSelectedPhaseTemplateId={setSelectedPhaseTemplateId}
              customTemplateId={customTemplateId}
              setCustomTemplateId={setCustomTemplateId}
              workspaceId={workspaceId}
              selectedProvider={selectedProvider}
              selectedModel={selectedModel}
              setSelectedModel={setSelectedModel}
              firstAgentKind={firstAgentKind}
              setFirstAgentKind={setFirstAgentKind}
              effort={effort}
              setEffort={setEffort}
              verbosity={verbosity}
              setVerbosity={setVerbosity}
              autoRun={autoRun}
              setAutoRun={setAutoRun}
              goal={goal}
              busy={busy}
              providerReady={providerReady}
              onPlanChange={setHasCustomPlan}
            />
          ) : null}

          {activeSection === 'provider' ? (
            <ProviderSection
              connectedProviderIds={connectedProviderIds}
              selectedProvider={selectedProvider}
              onRequestChange={requestProviderChange}
              pendingProviderSwitch={pendingProviderSwitch}
              onCancelSwitch={() => setPendingProviderSwitch(null)}
              onConfirmSwitch={confirmProviderSwitch}
              onClose={onClose}
              onOpenSettings={onOpenSettings}
            />
          ) : null}

          {activeSection === 'init' ? (
            <InitSection
              initEnabled={initEnabled}
              setInitEnabled={setInitEnabled}
              initContent={initContent}
              setInitContent={setInitContent}
              busy={busy}
            />
          ) : null}

          {activeSection === 'budget' ? (
            <BudgetSection softCapRaw={softCapRaw} setSoftCapRaw={setSoftCapRaw} busy={busy} />
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: Goal + branch                                                */
/* ──────────────────────────────────────────────────────────────────── */

interface GoalSectionProps {
  readonly goal: string;
  readonly setGoal: (v: string) => void;
  readonly branchSlug: string;
  readonly setBranchSlug: (v: string) => void;
  readonly slugGenerating: boolean;
  readonly branchPrefix: string;
  readonly setBranchPrefix: (v: string) => void;
  readonly branchMode: 'new' | 'existing';
  readonly setBranchMode: (m: 'new' | 'existing') => void;
  readonly existingBranches: ReadonlyArray<LocalBranchInfo>;
  readonly existingBranch: string;
  readonly setExistingBranch: (v: string) => void;
  readonly branchesLoading: boolean;
  readonly busy: boolean;
  readonly onGenerateSlug: () => void;
}

function GoalSection({
  goal,
  setGoal,
  branchSlug,
  setBranchSlug,
  slugGenerating,
  branchPrefix,
  setBranchPrefix,
  branchMode,
  setBranchMode,
  existingBranches,
  existingBranch,
  setExistingBranch,
  branchesLoading,
  busy,
  onGenerateSlug,
}: GoalSectionProps) {
  // Live-derived slug used when goal is set. Visible-only branch preview
  // string so the user sees the final shape.
  const fullBranch = `${branchPrefix.trim() || DEFAULT_BRANCH_PREFIX}/${branchSlug || 'branch-slug'}`;

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        icon={<Target size={14} aria-hidden className="text-primary" />}
        title="What needs to get done?"
        subtitle="Describe the task in plain English. We'll create a worktree and route it to an agent."
      />

      <div className="flex flex-col gap-2">
        <Textarea
          value={goal}
          placeholder="e.g. Refactor the auth middleware to use the new session adapter and drop the legacy cookie path."
          onChange={(e) => setGoal(e.target.value)}
          autoGrow
          minRows={4}
          maxRows={14}
          autoFocus
          disabled={busy}
          className="text-sm leading-relaxed"
        />
        <p className="text-2xs leading-relaxed text-muted-foreground/70">
          Tip: a clear, imperative sentence yields a better branch name and helps agents stay
          focused.
        </p>
      </div>

      {/* Branch — compact, prefix + slug live preview */}
      <div className="flex flex-col gap-3 rounded-lg border border-border-soft bg-subtle/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GitBranch size={13} aria-hidden className="text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">Branch</span>
          </div>
          <button
            type="button"
            onClick={() => setBranchMode(branchMode === 'new' ? 'existing' : 'new')}
            className="text-2xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            {branchMode === 'new' ? 'use existing branch instead' : 'create new branch instead'}
          </button>
        </div>

        {branchMode === 'new' ? (
          <>
            <div className="flex items-stretch gap-1 rounded-md border border-border bg-background px-1.5 py-1 font-mono text-sm focus-within:border-primary">
              <input
                type="text"
                value={branchPrefix}
                onChange={(e) => setBranchPrefix(sanitizePrefix(e.target.value))}
                disabled={busy}
                placeholder={DEFAULT_BRANCH_PREFIX}
                aria-label="Branch prefix"
                title="Branch prefix (editable). Saved per workspace."
                className="w-[5.5rem] bg-transparent px-1.5 py-1 text-muted-foreground outline-none placeholder:text-muted-foreground/40"
              />
              <span className="flex select-none items-center text-muted-foreground/50">/</span>
              {slugGenerating ? (
                <span className="flex flex-1 animate-pulse items-center px-1.5">
                  <span className="h-2 w-1/2 rounded bg-muted-foreground/20" />
                </span>
              ) : (
                <input
                  type="text"
                  value={branchSlug}
                  onChange={(e) => setBranchSlug(slugifyLive(e.target.value))}
                  placeholder="branch-slug"
                  disabled={busy}
                  aria-label="Branch slug"
                  className="flex-1 bg-transparent px-1.5 py-1 text-foreground outline-none placeholder:text-muted-foreground/40"
                />
              )}
              <button
                type="button"
                onClick={onGenerateSlug}
                disabled={!goal.trim() || slugGenerating || busy}
                title="Generate a better name from your goal"
                aria-label="Generate branch name"
                className={cn(
                  'flex shrink-0 items-center justify-center rounded px-2 transition-colors',
                  goal.trim() && !slugGenerating && !busy
                    ? 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    : 'cursor-not-allowed text-muted-foreground/30',
                )}
              >
                <Wand2 size={13} aria-hidden />
              </button>
            </div>
            <p className="flex items-center gap-1.5 text-2xs text-muted-foreground/70">
              <span>Preview:</span>
              <span className="font-mono text-muted-foreground">{fullBranch}</span>
            </p>
          </>
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
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: Workflow                                                     */
/* ──────────────────────────────────────────────────────────────────── */

interface WorkflowSectionProps {
  readonly workflowMode: WorkflowMode;
  readonly onModeChange: (m: WorkflowMode) => void;
  readonly phaseTemplates: ReadonlyArray<Workflow>;
  readonly selectedPhaseTemplateId: WorkflowId | '';
  readonly setSelectedPhaseTemplateId: (id: WorkflowId | '') => void;
  readonly customTemplateId: WorkflowId | '';
  readonly setCustomTemplateId: (id: WorkflowId | '') => void;
  readonly workspaceId: WorkspaceId;
  readonly selectedProvider: ProviderId;
  readonly selectedModel: string;
  readonly setSelectedModel: (m: string) => void;
  readonly firstAgentKind: AgentKind;
  readonly setFirstAgentKind: (k: AgentKind) => void;
  readonly effort: EffortLevel;
  readonly setEffort: (e: EffortLevel) => void;
  readonly verbosity: VerbosityLevel;
  readonly setVerbosity: (v: VerbosityLevel) => void;
  readonly autoRun: boolean;
  readonly setAutoRun: (v: boolean) => void;
  readonly goal: string;
  readonly busy: boolean;
  readonly providerReady: boolean;
  readonly onPlanChange: (v: boolean) => void;
}

function WorkflowSection(props: WorkflowSectionProps) {
  const {
    workflowMode,
    onModeChange,
    phaseTemplates,
    selectedPhaseTemplateId,
    setSelectedPhaseTemplateId,
    customTemplateId,
    setCustomTemplateId,
    workspaceId,
    selectedProvider,
    selectedModel,
    setSelectedModel,
    firstAgentKind,
    setFirstAgentKind,
    effort,
    setEffort,
    verbosity,
    setVerbosity,
    autoRun,
    setAutoRun,
    goal,
    busy,
    providerReady,
    onPlanChange,
  } = props;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        icon={<Layers size={14} aria-hidden className="text-primary" />}
        title="How should the session run?"
        subtitle="Pick a shape. You can always evolve it once the session is live."
      />

      {/* 3-card grid */}
      <div className="grid grid-cols-3 gap-3">
        {WORKFLOW_MODES.map((m) => {
          const Icon = m.icon;
          const active = workflowMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              aria-pressed={active}
              className={cn(
                'group relative flex flex-col items-start gap-2 rounded-lg border p-3.5 text-left transition-all',
                active
                  ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                  : 'border-border-soft bg-background hover:-translate-y-0.5 hover:border-border hover:bg-subtle/40 hover:shadow-sm',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'bg-muted/60 text-muted-foreground group-hover:bg-muted',
                  )}
                >
                  <Icon size={15} aria-hidden />
                </span>
                <div className="flex items-center gap-1">
                  {m.beta ? (
                    <span className="rounded bg-warning/20 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-warning">
                      beta
                    </span>
                  ) : null}
                  {active ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check size={10} aria-hidden />
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-col gap-0.5">
                <span
                  className={cn(
                    'text-sm font-semibold leading-tight',
                    active ? 'text-foreground' : 'text-foreground/90',
                  )}
                >
                  {m.label}
                </span>
                <span className="text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
                  {m.tagline}
                </span>
              </div>
              <p className="text-2xs leading-relaxed text-muted-foreground">{m.description}</p>
            </button>
          );
        })}
      </div>

      {/* Mode-specific body */}
      <div className="rounded-lg border border-border-soft bg-subtle/30 p-4">
        {workflowMode === 'single' ? (
          <SingleAgentPanel
            firstAgentKind={firstAgentKind}
            setFirstAgentKind={setFirstAgentKind}
            selectedProvider={selectedProvider}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            effort={effort}
            setEffort={setEffort}
            verbosity={verbosity}
            setVerbosity={setVerbosity}
            providerReady={providerReady}
            busy={busy}
          />
        ) : null}

        {workflowMode === 'preset' ? (
          <PresetPanel
            phaseTemplates={phaseTemplates}
            selectedPhaseTemplateId={selectedPhaseTemplateId}
            setSelectedPhaseTemplateId={setSelectedPhaseTemplateId}
            onSwitchToCustom={() => onModeChange('custom')}
            busy={busy}
          />
        ) : null}

        {workflowMode === 'custom' ? (
          <CustomPanel
            phaseTemplates={phaseTemplates}
            customTemplateId={customTemplateId}
            setCustomTemplateId={setCustomTemplateId}
            workspaceId={workspaceId}
            selectedProvider={selectedProvider}
            goal={goal}
            onPlanChange={onPlanChange}
          />
        ) : null}
      </div>

      {workflowMode !== 'single' && selectedPhaseTemplateId !== '' ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border-soft bg-background px-3 py-2.5 text-xs">
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
    </div>
  );
}

interface SingleAgentPanelProps {
  readonly firstAgentKind: AgentKind;
  readonly setFirstAgentKind: (k: AgentKind) => void;
  readonly selectedProvider: ProviderId;
  readonly selectedModel: string;
  readonly setSelectedModel: (m: string) => void;
  readonly effort: EffortLevel;
  readonly setEffort: (e: EffortLevel) => void;
  readonly verbosity: VerbosityLevel;
  readonly setVerbosity: (v: VerbosityLevel) => void;
  readonly providerReady: boolean;
  readonly busy: boolean;
}

function SingleAgentPanel({
  firstAgentKind,
  setFirstAgentKind,
  selectedProvider,
  selectedModel,
  setSelectedModel,
  effort,
  setEffort,
  verbosity,
  setVerbosity,
  providerReady,
  busy,
}: SingleAgentPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        title="Configure the first agent"
        subtitle="One conversation, ready to talk. You can spawn more agents from the sidebar anytime."
      />
      <Field label="Agent role" hint="Sets the system prompt and default tools.">
        <AgentKindSelect value={firstAgentKind} onChange={setFirstAgentKind} disabled={busy} />
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
          <EffortSelect model={selectedModel} value={effort} onChange={setEffort} disabled={busy} />
        </InlineField>
        <InlineField label="Verbosity">
          <VerbositySelect value={verbosity} onChange={setVerbosity} disabled={busy} />
        </InlineField>
      </div>
    </div>
  );
}

interface PresetPanelProps {
  readonly phaseTemplates: ReadonlyArray<Workflow>;
  readonly selectedPhaseTemplateId: WorkflowId | '';
  readonly setSelectedPhaseTemplateId: (id: WorkflowId | '') => void;
  readonly onSwitchToCustom: () => void;
  readonly busy: boolean;
}

function PresetPanel({
  phaseTemplates,
  selectedPhaseTemplateId,
  setSelectedPhaseTemplateId,
  onSwitchToCustom,
  busy,
}: PresetPanelProps) {
  if (phaseTemplates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <Layers size={28} className="text-muted-foreground/30" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">No workflow presets yet</p>
          <p className="max-w-xs text-2xs leading-relaxed text-muted-foreground">
            Workspaces ship with a small library. If yours is empty, design one with the planner.
          </p>
        </div>
        <button
          type="button"
          onClick={onSwitchToCustom}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Sparkles size={11} aria-hidden /> Switch to custom plan
        </button>
      </div>
    );
  }
  const selected = phaseTemplates.find((t) => t.id === selectedPhaseTemplateId) ?? null;
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        title="Pick a blueprint"
        subtitle={`${phaseTemplates.length} preset${phaseTemplates.length === 1 ? '' : 's'} available in this workspace. Each preset runs its steps in order.`}
      />
      <div className="flex flex-col gap-2">
        {phaseTemplates.map((t) => {
          const active = selectedPhaseTemplateId === t.id;
          const sorted = [...t.steps].sort((a, b) => a.ordinal - b.ordinal);
          return (
            <button
              key={t.id}
              type="button"
              disabled={busy}
              onClick={() => setSelectedPhaseTemplateId(active ? '' : t.id)}
              className={cn(
                'flex flex-col gap-2 rounded-md border px-3 py-2.5 text-left transition-colors',
                active
                  ? 'border-primary bg-primary/5'
                  : 'border-border-soft bg-background hover:border-border hover:bg-subtle/40',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded-full',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground/40',
                  )}
                >
                  {active ? <Check size={10} aria-hidden /> : null}
                </span>
                <span className="flex-1 truncate text-xs font-semibold text-foreground">
                  {t.name}
                </span>
                <span className="shrink-0 text-2xs text-muted-foreground">
                  {sorted.length} step{sorted.length === 1 ? '' : 's'}
                </span>
              </div>
              {t.description ? (
                <p className="pl-6 text-2xs leading-relaxed text-muted-foreground">
                  {t.description}
                </p>
              ) : null}
              {sorted.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1 pl-6">
                  {sorted.map((step, i) => {
                    const kind = inferAgentKindFromName(step.name);
                    const pal = AGENT_KIND_PALETTE[kind];
                    return (
                      <span key={step.id} className="flex items-center gap-1">
                        {i > 0 ? (
                          <span className="text-2xs text-muted-foreground/40">→</span>
                        ) : null}
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full bg-background px-1.5 py-0.5 text-2xs',
                            pal.fg,
                          )}
                        >
                          <span className={cn('size-1.5 rounded-full', pal.bg)} />
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
      {selected ? <WorkflowPreview template={selected} /> : null}
    </div>
  );
}

interface CustomPanelProps {
  readonly phaseTemplates: ReadonlyArray<Workflow>;
  readonly customTemplateId: WorkflowId | '';
  readonly setCustomTemplateId: (id: WorkflowId | '') => void;
  readonly workspaceId: WorkspaceId;
  readonly selectedProvider: ProviderId;
  readonly goal: string;
  readonly onPlanChange: (v: boolean) => void;
}

function CustomPanel({
  phaseTemplates,
  customTemplateId,
  setCustomTemplateId,
  workspaceId,
  selectedProvider,
  goal,
  onPlanChange,
}: CustomPanelProps) {
  if (customTemplateId !== '') {
    const customTemplate = phaseTemplates.find((t) => t.id === customTemplateId) ?? null;
    return (
      <div className="flex flex-col gap-4">
        <PanelHeader
          title="Custom plan ready"
          subtitle={
            customTemplate
              ? `Planner produced a workflow with ${customTemplate.steps.length} step${customTemplate.steps.length === 1 ? '' : 's'}. Review below.`
              : 'Planner produced a workflow. Review below.'
          }
        />
        <WorkflowPreview template={customTemplate} />
        <div>
          <button
            type="button"
            onClick={() => setCustomTemplateId('')}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-soft bg-background px-2.5 py-1.5 text-2xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
          >
            <Sparkles size={11} aria-hidden /> Re-plan
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <PanelHeader
        title="Design a plan from your goal"
        subtitle="The planner drafts a sequence of agents tailored to what you typed. Tune it before locking it in."
      />
      <PlannerWidget
        workspaceId={workspaceId}
        providerId={selectedProvider}
        initialTheme={goal}
        onWorkflowReady={(workflowId) => setCustomTemplateId(workflowId)}
        onPlanChange={onPlanChange}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: Provider                                                     */
/* ──────────────────────────────────────────────────────────────────── */

interface ProviderSectionProps {
  readonly connectedProviderIds: ReadonlySet<ProviderId>;
  readonly selectedProvider: ProviderId;
  readonly onRequestChange: (id: ProviderId) => void;
  readonly pendingProviderSwitch: ProviderId | null;
  readonly onCancelSwitch: () => void;
  readonly onConfirmSwitch: () => void;
  readonly onClose: () => void;
  readonly onOpenSettings: () => void;
}

function ProviderSection({
  connectedProviderIds,
  selectedProvider,
  onRequestChange,
  pendingProviderSwitch,
  onCancelSwitch,
  onConfirmSwitch,
  onClose,
}: ProviderSectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        icon={<Zap size={14} aria-hidden className="text-primary" />}
        title="Which provider should drive this session?"
        subtitle="Affects model availability and routing. You can override per-turn later."
      />
      <div className="grid grid-cols-3 gap-2">
        {PROVIDER_ORDER.map((id) => {
          const connected = connectedProviderIds.has(id);
          const selected = selectedProvider === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!connected}
              onClick={() => onRequestChange(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-md border px-3 py-3 text-sm transition-colors',
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
      {pendingProviderSwitch ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" aria-hidden />
          <div className="flex flex-1 flex-col gap-1.5">
            <p className="text-xs font-medium text-foreground">
              Switching provider will discard your custom workflow.
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={onCancelSwitch}>
                Cancel
              </Button>
              <Button size="sm" onClick={onConfirmSwitch}>
                Switch provider
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: Init                                                         */
/* ──────────────────────────────────────────────────────────────────── */

interface InitSectionProps {
  readonly initEnabled: boolean;
  readonly setInitEnabled: (v: boolean) => void;
  readonly initContent: string;
  readonly setInitContent: (v: string) => void;
  readonly busy: boolean;
}

function InitSection({
  initEnabled,
  setInitEnabled,
  initContent,
  setInitContent,
  busy,
}: InitSectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        icon={<Terminal size={14} aria-hidden className="text-primary" />}
        title="Init script"
        subtitle="Workspace setup that runs before agents start. Edit for this session only."
      />
      <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border-soft bg-background px-3 py-2.5 text-xs">
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
      <Field label="Script" hint="Edit for this session only. Changes won't save to workspace.">
        <Textarea
          value={initContent}
          onChange={(e) => setInitContent(e.target.value)}
          className="min-h-[220px] resize-y font-mono text-xs"
          disabled={!initEnabled || busy}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          rows={10}
        />
      </Field>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Section: Budget                                                       */
/* ──────────────────────────────────────────────────────────────────── */

interface BudgetSectionProps {
  readonly softCapRaw: string;
  readonly setSoftCapRaw: (v: string) => void;
  readonly busy: boolean;
}

function BudgetSection({ softCapRaw, setSoftCapRaw, busy }: BudgetSectionProps) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        icon={<DollarSign size={14} aria-hidden className="text-primary" />}
        title="Soft cap"
        subtitle="Optional spend limit. Session gets flagged once exceeded — agents keep running."
      />
      <Field label="Soft cap (USD)" hint="Leave blank to skip.">
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
  );
}

/* ──────────────────────────────────────────────────────────────────── */
/* Building blocks                                                       */
/* ──────────────────────────────────────────────────────────────────── */

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          {icon}
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-foreground">{title}</span>
      <p className="text-2xs leading-relaxed text-muted-foreground">{subtitle}</p>
    </div>
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

function WorkflowPreview({ template }: { template: Workflow | null }) {
  if (!template) return null;
  if (template.steps.length === 0) {
    return (
      <p className="rounded-md bg-subtle px-3 py-2 text-xs text-muted-foreground">
        This workflow has no steps yet. Add some via the planner above.
      </p>
    );
  }
  const sortedSteps = [...template.steps].sort((a, b) => a.ordinal - b.ordinal);
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-soft bg-background p-3">
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
          const eff = step.effort ?? null;
          const verb = step.verbosity ?? null;
          return (
            <li
              key={step.id}
              className="flex items-center gap-2 rounded-md bg-subtle px-2 py-1 text-xs"
            >
              <span className="font-mono text-2xs text-muted-foreground">{i + 1}.</span>
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  AGENT_KIND_PALETTE[inferAgentKindFromName(step.name)].bg,
                )}
              />
              <span className="flex-1 truncate font-medium text-foreground">{step.name}</span>
              {model || eff || verb ? (
                <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                  {[model, eff, verb ? `v:${verb}` : null].filter(Boolean).join(' · ')}
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
            : 'border-border-soft bg-background hover:border-border hover:bg-muted/50',
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
