import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { Send, Square, X } from 'lucide-react';
import { Divider, Textarea } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  BudgetAlert,
  BudgetAlertKind,
  ProviderId,
  Session,
  SessionId,
  Skill,
  TurnProviderOverride,
  Workflow,
  WorkspaceScript,
} from '@goodboy/types';
import { PROVIDER_CAPABILITIES, assessTurnWeight, getDefaultTurnModel } from '@goodboy/core';
import { insertNudgeEvent, updateNudgeEventOutcome, type NudgeOutcome } from '@goodboy/db';
import { tauriDatabase } from '../../../../shared/lib/db';
import type { IsoDateTime } from '@goodboy/types';
import { useShallow } from 'zustand/react/shallow';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { formatError } from '../../../../shared/lib/errors';
import { RoutingIndicator } from '../RoutingIndicator';
import { useToast, type ToastKind } from '../../../../app/components/Toast';
import {
  QuickActionsPopover,
  ScriptResultRow,
  buildAgentActions,
  buildScriptActions,
  buildSkillActions,
  buildWorkflowActions,
  parseQuery,
  type QuickActionItem,
  type ScriptResultState,
} from '../../../quick-actions';
import {
  type VerbosityLevel,
  readVerbosity,
  writeVerbosity,
  readAgentVerbosity,
  writeAgentVerbosity,
} from '../../../../features/settings/verbosity';
import { EFFORT_LEVELS, type EffortLevel, suggestLighterModel } from '../../utils/chat-constants';
import { ProviderUsagePill } from '../ProviderUsagePill';
import { ModelPicker } from '../ModelPicker';
import { PermissionModePicker } from '../../../../features/permissions/components/PermissionModePicker';
import { RightSizeCard } from '../RightSizeCard';
import { NudgeCard } from '../NudgeCard';
import { ClipboardCheck } from 'lucide-react';
import { STORAGE_PREFIXES } from '../../../../shared/lib/storage-keys';
import { SESSION_FEATURES, WORKSPACE_FEATURES } from '../../../../shared/lib/features';
import {
  AGENT_KIND_META,
  inferAgentKindFromName,
  type AgentKind,
} from '../../../session/agent-kind';
import { detectScopeMismatch, type ScopeMismatch } from '../../utils/scope-mismatch';

const RUNNING_KINDS = new Set(['starting', 'running']);

// Prefix-mode trigger for the in-chat quick-actions popover: a leading
// $ / ~ @ followed by a single space-free token. A space closes the popover
// so the message sends normally.
const CHAT_PREFIX_RE = /^\s*[$/~@][^\s]*$/;

// Idle-state composer placeholder — shows the whole prefix grammar at once
// so the user is taught every quick-action up front, not over time.
const CHAT_PLACEHOLDER = 'Message Claude — $ scripts · ~ workflows · @ agents';

const EFFORT_STORAGE_PREFIX = STORAGE_PREFIXES.effort;
const MODEL_STORAGE_PREFIX = STORAGE_PREFIXES.model;
const PROVIDER_STORAGE_PREFIX = STORAGE_PREFIXES.provider;
const AGENT_EFFORT_PREFIX = STORAGE_PREFIXES.agentEffort;
const AGENT_MODEL_PREFIX = STORAGE_PREFIXES.agentModel;
const AGENT_PROVIDER_PREFIX = STORAGE_PREFIXES.agentProvider;

function readEffort(sessionId: SessionId): EffortLevel {
  try {
    const raw = localStorage.getItem(`${EFFORT_STORAGE_PREFIX}${sessionId}`);
    if (raw && EFFORT_LEVELS.includes(raw as EffortLevel)) return raw as EffortLevel;
  } catch {
    // ignore
  }
  return 'medium';
}

function writeEffort(sessionId: SessionId, level: EffortLevel): void {
  try {
    localStorage.setItem(`${EFFORT_STORAGE_PREFIX}${sessionId}`, level);
  } catch {
    // ignore
  }
}

function readModel(sessionId: SessionId): string | null {
  try {
    return localStorage.getItem(`${MODEL_STORAGE_PREFIX}${sessionId}`);
  } catch {
    return null;
  }
}

function writeModel(sessionId: SessionId, model: string | null): void {
  try {
    if (model === null) {
      localStorage.removeItem(`${MODEL_STORAGE_PREFIX}${sessionId}`);
    } else {
      localStorage.setItem(`${MODEL_STORAGE_PREFIX}${sessionId}`, model);
    }
  } catch {
    // ignore
  }
}

function readProvider(sessionId: SessionId): ProviderId | null {
  try {
    const raw = localStorage.getItem(`${PROVIDER_STORAGE_PREFIX}${sessionId}`);
    const valid: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];
    if (raw && valid.includes(raw as ProviderId)) return raw as ProviderId;
  } catch {
    // ignore
  }
  return null;
}

function writeProvider(sessionId: SessionId, provider: ProviderId | null): void {
  try {
    if (provider === null) {
      localStorage.removeItem(`${PROVIDER_STORAGE_PREFIX}${sessionId}`);
    } else {
      localStorage.setItem(`${PROVIDER_STORAGE_PREFIX}${sessionId}`, provider);
    }
  } catch {
    // ignore
  }
}

function readAgentEffort(agentId: AgentId): EffortLevel | null {
  try {
    const raw = localStorage.getItem(`${AGENT_EFFORT_PREFIX}${agentId}`);
    if (raw && EFFORT_LEVELS.includes(raw as EffortLevel)) return raw as EffortLevel;
  } catch {
    // ignore
  }
  return null;
}

function writeAgentEffort(agentId: AgentId, level: EffortLevel): void {
  try {
    localStorage.setItem(`${AGENT_EFFORT_PREFIX}${agentId}`, level);
  } catch {
    // ignore
  }
}

function readAgentModel(agentId: AgentId): string | null {
  try {
    return localStorage.getItem(`${AGENT_MODEL_PREFIX}${agentId}`);
  } catch {
    return null;
  }
}

function writeAgentModel(agentId: AgentId, model: string | null): void {
  try {
    if (model === null) {
      localStorage.removeItem(`${AGENT_MODEL_PREFIX}${agentId}`);
    } else {
      localStorage.setItem(`${AGENT_MODEL_PREFIX}${agentId}`, model);
    }
  } catch {
    // ignore
  }
}

function readAgentProvider(agentId: AgentId): ProviderId | null {
  try {
    const raw = localStorage.getItem(`${AGENT_PROVIDER_PREFIX}${agentId}`);
    const valid: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];
    if (raw && valid.includes(raw as ProviderId)) return raw as ProviderId;
  } catch {
    // ignore
  }
  return null;
}

function writeAgentProvider(agentId: AgentId, provider: ProviderId | null): void {
  try {
    if (provider === null) {
      localStorage.removeItem(`${AGENT_PROVIDER_PREFIX}${agentId}`);
    } else {
      localStorage.setItem(`${AGENT_PROVIDER_PREFIX}${agentId}`, provider);
    }
  } catch {
    // ignore
  }
}

interface ChatInputProps {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
}

function toastKindForAlert(kind: BudgetAlertKind): ToastKind {
  return kind === 'provider-exceeded' || kind === 'session-exceeded' ? 'error' : 'warning';
}

function toastMessageForAlert(alert: BudgetAlert): string {
  const pct = alert.capUsd > 0 ? Math.round((alert.currentUsd / alert.capUsd) * 100) : 0;
  if (alert.kind === 'provider-threshold') {
    return `provider ${alert.provider ?? '?'} budget at ${pct}%`;
  }
  if (alert.kind === 'provider-exceeded') {
    return `provider ${alert.provider ?? '?'} budget exceeded`;
  }
  if (alert.kind === 'session-threshold') {
    return `session budget at ${pct}%`;
  }
  return 'session budget exceeded';
}

export function ChatInput({ session, providerDisconnected = false }: ChatInputProps) {
  const sendTurn = useAppStore((s) => s.sendTurn);
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const sessionNudge = useAppStore((s) => s.sessionNudges[session.id] ?? null);
  const dismissSessionNudge = useAppStore((s) => s.dismissSessionNudge);
  const acceptSessionNudgeHandoff = useAppStore((s) => s.acceptSessionNudgeHandoff);
  const spawnAgent = useAppStore((s) => s.spawnAgent);
  const selectedAgentId = useAppStore((s) => s.selectedAgentId[session.id] ?? null);
  const agentKindOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentKindOverride[selectedAgentId] ?? null) : null,
  );
  const selectedAgentName = useAppStore((s) => {
    if (!selectedAgentId) return null;
    const runs = s.sessionPhaseRuns[session.id] ?? [];
    return runs.find((r) => r.id === selectedAgentId)?.name ?? null;
  });
  const activeAgentKind: AgentKind | null =
    agentKindOverride ?? (selectedAgentName ? inferAgentKindFromName(selectedAgentName) : null);
  const connectedProviders = useAppStore(
    useShallow((s) => s.providers.filter((p) => p.connection === 'connected')),
  );
  const workspaceSkills = useAppStore(
    useShallow((s) => s.skills[session.workspaceId] ?? EMPTY_ARRAY),
  );
  const workspaceScripts = useAppStore(
    useShallow((s) => s.workspaceScripts[session.workspaceId] ?? EMPTY_ARRAY),
  );
  const runScript = useAppStore((s) => s.runScript);
  const sessionWorktree = useAppStore((s) => (s.sessionWorktrees[session.id] ?? [])[0] ?? null);
  const loadScripts = useAppStore((s) => s.loadScripts);
  const workspaceWorkflows = useAppStore(
    useShallow((s) => s.phaseTemplates[session.workspaceId] ?? EMPTY_ARRAY),
  ) as ReadonlyArray<Workflow>;
  const sessionAgents = useAppStore(
    useShallow((s) => s.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY),
  ) as ReadonlyArray<Agent>;
  const selectAgent = useAppStore((s) => s.selectAgent);
  const attachWorkflowToSession = useAppStore((s) => s.attachWorkflowToSession);
  const loadPhaseTemplates = useAppStore((s) => s.loadPhaseTemplates);
  const loadPhaseRunsForSession = useAppStore((s) => s.loadPhaseRunsForSession);

  const { showToast } = useToast();
  const value = useAppStore((s) => (selectedAgentId ? (s.agentDraft[selectedAgentId] ?? '') : ''));
  const setAgentDraft = useAppStore((s) => s.setAgentDraft);
  const clearAgentDraft = useAppStore((s) => s.clearAgentDraft);
  const setValue = useCallback(
    (next: string) => {
      if (!selectedAgentId) return;
      if (next.length === 0) clearAgentDraft(selectedAgentId);
      else setAgentDraft(selectedAgentId, next);
    },
    [selectedAgentId, setAgentDraft, clearAgentDraft],
  );

  const [error, setError] = useState<string | null>(null);
  interface FailedTurn {
    readonly content: string;
    readonly override: TurnProviderOverride | undefined;
  }
  const [lastFailedTurn, setLastFailedTurn] = useState<FailedTurn | null>(null);
  const [selectedProvider, setSelectedProviderState] = useState<ProviderId | null>(() =>
    readProvider(session.id),
  );
  const [selectedModel, setSelectedModelState] = useState<string | null>(() =>
    readModel(session.id),
  );
  const [effort, setEffortState] = useState<EffortLevel>(() => readEffort(session.id));
  const [verbosity, setVerbosityState] = useState<VerbosityLevel>(() => readVerbosity(session.id));
  const [showPopover, setShowPopover] = useState(false);
  const [scriptResult, setScriptResult] = useState<ScriptResultState | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const runSeqRef = useRef(0);

  const parsed = useMemo(() => parseQuery(value), [value]);
  const inPrefixMode = CHAT_PREFIX_RE.test(value);

  const selectedAgentState = useAppStore((s) =>
    selectedAgentId ? (s.agentTurnState[selectedAgentId] ?? null) : null,
  );
  const agentModelOverride = useAppStore((s) =>
    selectedAgentId ? (s.agentModelOverride[selectedAgentId] ?? null) : null,
  );
  const isFirstTurnForAgent = useAppStore((s) =>
    selectedAgentId ? (s.agentRunHistory[selectedAgentId]?.length ?? 0) === 0 : false,
  );
  const isRunning = RUNNING_KINDS.has(selectedAgentState?.kind ?? session.state.kind);
  const wasRunning = useRef(isRunning);

  const currentProviderRef = useRef(selectedProvider);
  currentProviderRef.current = selectedProvider;
  const currentModelRef = useRef(selectedModel);
  currentModelRef.current = selectedModel;
  const currentEffortRef = useRef(effort);
  currentEffortRef.current = effort;
  const currentVerbosityRef = useRef(verbosity);
  currentVerbosityRef.current = verbosity;
  interface QueuedTurn {
    readonly content: string;
    readonly override: TurnProviderOverride | undefined;
  }
  const [queued, setQueued] = useState<QueuedTurn | null>(null);
  const [rightSizePending, setRightSizePending] = useState<string | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);
  interface ScopePending {
    readonly content: string;
    readonly mismatch: ScopeMismatch;
  }
  const [scopePending, setScopePending] = useState<ScopePending | null>(null);
  const [scopeNudgeEventId, setScopeNudgeEventId] = useState<string | null>(null);
  const canSend = !providerDisconnected && value.trim().length > 0;
  const allowOverride = session.providerPreference.allowTurnOverride;
  const defaultProvider = session.providerPreference.defaultProvider;

  const effectiveProvider: ProviderId = selectedProvider ?? defaultProvider;
  const defaultModel =
    agentModelOverride ??
    session.providerPreference.defaultModel ??
    getDefaultTurnModel(defaultProvider);
  const effectiveModel = selectedModel ?? defaultModel;

  const providerModels = PROVIDER_CAPABILITIES[effectiveProvider].models;

  const providerChanged = selectedProvider !== null && selectedProvider !== defaultProvider;
  const modelChanged = selectedModel !== null && selectedModel !== defaultModel;
  const routingOverride: TurnProviderOverride | undefined =
    allowOverride && (providerChanged || modelChanged)
      ? {
          providerId: effectiveProvider,
          ...(modelChanged ? { model: effectiveModel } : {}),
        }
      : undefined;

  const connectedProviderIds = connectedProviders.map((p) => p.id);

  const onValueChange = (next: string) => {
    setValue(next);
    setShowPopover(CHAT_PREFIX_RE.test(next));
  };

  const onPickScript = useCallback(
    async (script: WorkspaceScript) => {
      if (!sessionWorktree) {
        showToast('warning', `${script.name} — open a session worktree to run scripts`);
        return;
      }
      const seq = ++runSeqRef.current;
      setValue('');
      setShowPopover(false);
      setScriptResult({ script, status: 'pending', result: null });
      try {
        const result = await runScript(session.id, script.id, sessionWorktree);
        if (runSeqRef.current !== seq) return;
        setScriptResult({
          script,
          status: result.exitCode === 0 ? 'ok' : 'error',
          result,
        });
      } catch (err) {
        if (runSeqRef.current !== seq) return;
        setScriptResult({
          script,
          status: 'error',
          result: { stdout: '', stderr: formatError(err), exitCode: -1 },
        });
      }
    },
    [runScript, setValue, session.id, sessionWorktree, showToast],
  );

  const onPickSkill = useCallback(
    (skill: Skill) => {
      setValue(`/${skill.name} `);
      setShowPopover(false);
      wrapperRef.current?.querySelector('textarea')?.focus();
    },
    [setValue],
  );

  const onPickWorkflow = useCallback(
    async (workflow: Workflow) => {
      setValue('');
      setShowPopover(false);
      try {
        await attachWorkflowToSession(session.id, workflow.id);
        showToast('success', `workflow "${workflow.name}" started`);
      } catch (err) {
        showToast('error', formatError(err));
      }
    },
    [attachWorkflowToSession, session.id, showToast, setValue],
  );

  const onSwitchAgent = useCallback(
    (agent: Agent) => {
      setValue('');
      setShowPopover(false);
      void selectAgent(session.id, agent.id);
    },
    [selectAgent, session.id, setValue],
  );

  const onSpawnAgent = useCallback(async () => {
    setValue('');
    setShowPopover(false);
    try {
      await spawnAgent(session.id, {});
      showToast('success', 'new agent spawned');
    } catch (err) {
      showToast('error', formatError(err));
    }
  }, [spawnAgent, session.id, showToast, setValue]);

  const quickItems = useMemo<ReadonlyArray<QuickActionItem> | null>(() => {
    const symbol = parsed.prefix?.symbol;
    if (symbol === '$') {
      return buildScriptActions(workspaceScripts, (script) => void onPickScript(script));
    }
    if (symbol === '~') {
      if (session.workflowId) return [];
      return buildWorkflowActions(workspaceWorkflows, (workflow) => void onPickWorkflow(workflow));
    }
    if (symbol === '@') {
      return buildAgentActions(sessionAgents, onSwitchAgent, () => void onSpawnAgent());
    }
    if (symbol === '/' && WORKSPACE_FEATURES.skills) {
      return buildSkillActions(workspaceSkills, onPickSkill);
    }
    return null;
  }, [
    parsed.prefix,
    session.workflowId,
    workspaceScripts,
    workspaceWorkflows,
    sessionAgents,
    workspaceSkills,
    onPickScript,
    onPickWorkflow,
    onSwitchAgent,
    onSpawnAgent,
    onPickSkill,
  ]);

  const filteredQuickItems = useMemo<ReadonlyArray<QuickActionItem>>(() => {
    if (!quickItems) return EMPTY_ARRAY;
    const q = parsed.query.toLowerCase();
    if (q.length === 0) return quickItems;
    return quickItems.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || (it.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [quickItems, parsed.query]);

  const popoverOpen = showPopover && inPrefixMode && quickItems !== null;
  const quickEmptyHint =
    parsed.prefix?.symbol === '$'
      ? 'no scripts. add them in workspace settings.'
      : parsed.prefix?.symbol === '~'
        ? session.workflowId
          ? 'this session already has a workflow.'
          : 'no workflows. create one in workspace settings.'
        : parsed.prefix?.symbol === '@'
          ? 'no agents in this session.'
          : 'no skills. create one in settings.';

  const onQuickActionSelect = useCallback((item: QuickActionItem) => item.perform(), []);
  const dismissPopover = useCallback(() => setShowPopover(false), []);

  const setEffort = (level: EffortLevel) => {
    setEffortState(level);
    writeEffort(session.id, level);
    if (selectedAgentId) writeAgentEffort(selectedAgentId, level);
  };

  const setVerbosity = (level: VerbosityLevel) => {
    setVerbosityState(level);
    writeVerbosity(session.id, level);
    if (selectedAgentId) writeAgentVerbosity(selectedAgentId, level);
  };

  const setSelectedProvider = (id: ProviderId | null) => {
    setSelectedProviderState(id);
    writeProvider(session.id, id);
    if (selectedAgentId) writeAgentProvider(selectedAgentId, id);
  };

  const setSelectedModel = (id: string | null) => {
    setSelectedModelState(id);
    writeModel(session.id, id);
    if (selectedAgentId) writeAgentModel(selectedAgentId, id);
  };

  const onSelectProvider = (id: ProviderId) => {
    if (!connectedProviderIds.includes(id)) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-settings', { detail: { section: 'providers' } }),
      );
      return;
    }
    if (!allowOverride || isRunning) return;
    setSelectedProvider(id);
    setSelectedModel(null);
  };

  const onSelectModel = (id: string) => {
    if (!allowOverride || isRunning) return;
    setSelectedModel(id);
  };

  const dispatchTurn = useCallback(
    async (content: string, override: TurnProviderOverride | undefined) => {
      try {
        await sendTurn({
          sessionId: session.id,
          content,
          override,
          onNewAlerts: (alerts) => {
            if (!SESSION_FEATURES.budget) return;
            for (const alert of alerts) {
              showToast(toastKindForAlert(alert.kind), toastMessageForAlert(alert));
            }
          },
        });
        setLastFailedTurn(null);
      } catch (err) {
        setError(formatError(err));
        setLastFailedTurn({ content, override });
      }
    },
    [sendTurn, session.id, showToast],
  );

  const sendWith = async (content: string, modelOverrideId: string | null) => {
    const useModel = modelOverrideId ?? (modelChanged ? effectiveModel : null);
    const override: TurnProviderOverride | undefined =
      allowOverride && (providerChanged || useModel !== null)
        ? {
            providerId: effectiveProvider,
            ...(useModel !== null ? { model: useModel } : {}),
          }
        : undefined;

    if (isRunning) {
      setQueued({ content, override });
      return;
    }

    await dispatchTurn(content, override);
  };

  const onSend = async () => {
    const content = value.trim();
    if (!content || providerDisconnected) return;
    setError(null);
    setLastFailedTurn(null);

    if (!isRunning && scopePending === null && activeAgentKind !== null && !session.workflowId) {
      const mismatch = detectScopeMismatch(content, activeAgentKind);
      if (mismatch) {
        const id = crypto.randomUUID();
        try {
          await insertNudgeEvent(tauriDatabase, {
            id,
            ts: new Date().toISOString() as IsoDateTime,
            kind: 'scope-mismatch',
            contextJson: JSON.stringify({
              sessionId: session.id,
              agentKind: activeAgentKind,
              mismatchKind: mismatch.kind,
              suggested: mismatch.suggestedAgentKind,
            }),
            outcome: null,
            outcomeTs: null,
          });
        } catch {
          // telemetry is best-effort
        }
        setScopeNudgeEventId(id);
        setScopePending({ content, mismatch });
        return;
      }
    }

    if (allowOverride && !isRunning && rightSizeSuggested !== null && rightSizePending === null) {
      setRightSizePending(content);
      return;
    }

    setValue('');
    await sendWith(content, null);
  };

  const recordScopeOutcome = async (outcome: NudgeOutcome) => {
    if (!scopeNudgeEventId) return;
    try {
      await updateNudgeEventOutcome(
        tauriDatabase,
        scopeNudgeEventId,
        outcome,
        new Date().toISOString() as IsoDateTime,
      );
    } catch {
      // best-effort
    }
    setScopeNudgeEventId(null);
  };

  const onScopeSpawn = async () => {
    if (!scopePending) return;
    const target = scopePending.mismatch.suggestedAgentKind;
    const content = scopePending.content;
    setScopePending(null);
    setValue(content);
    await recordScopeOutcome('accepted');
    try {
      await spawnAgent(session.id, { kindOverride: target });
    } catch {
      // ignore — user will see standard error path elsewhere
    }
  };

  const onScopeSendAnyway = async () => {
    if (!scopePending) return;
    const content = scopePending.content;
    setScopePending(null);
    setValue('');
    await recordScopeOutcome('overridden');
    await sendWith(content, null);
  };

  const onScopeDismiss = async () => {
    setScopePending(null);
    await recordScopeOutcome('dismissed');
  };

  const onUseSuggested = async () => {
    const content = rightSizePending;
    if (content === null) return;
    const suggested = rightSizeSuggested;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    if (suggested !== null) setSelectedModel(suggested);
    await sendWith(content, suggested);
  };

  const onKeepCurrent = async () => {
    const content = rightSizePending;
    if (content === null) return;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    await sendWith(content, null);
  };

  const onChangeModel = () => {
    setRightSizePending(null);
    setRightSizeDismissed(true);
  };

  useEffect(() => {
    const wasRun = wasRunning.current;
    wasRunning.current = isRunning;
    if (wasRun && !isRunning && queued) {
      const { content, override } = queued;
      setQueued(null);
      void dispatchTurn(content, override);
    }
  }, [isRunning, queued, dispatchTurn]);

  const lastAgentIdRef = useRef(selectedAgentId);
  useEffect(() => {
    if (lastAgentIdRef.current === selectedAgentId) return;
    const outgoingAgentId = lastAgentIdRef.current;
    lastAgentIdRef.current = selectedAgentId;

    if (outgoingAgentId !== null) {
      writeAgentProvider(outgoingAgentId, currentProviderRef.current);
      writeAgentModel(outgoingAgentId, currentModelRef.current);
      writeAgentEffort(outgoingAgentId, currentEffortRef.current);
      writeAgentVerbosity(outgoingAgentId, currentVerbosityRef.current);
    }

    const restoredProvider = selectedAgentId !== null ? readAgentProvider(selectedAgentId) : null;
    const restoredModel = selectedAgentId !== null ? readAgentModel(selectedAgentId) : null;
    const restoredEffort = selectedAgentId !== null ? readAgentEffort(selectedAgentId) : null;
    const restoredVerbosity = selectedAgentId !== null ? readAgentVerbosity(selectedAgentId) : null;

    setSelectedProviderState(restoredProvider);
    setSelectedModelState(restoredModel);
    if (restoredEffort !== null) setEffortState(restoredEffort);
    if (restoredVerbosity !== null) setVerbosityState(restoredVerbosity);

    setRightSizePending(null);
    setRightSizeDismissed(false);
    setScopePending(null);
    setScopeNudgeEventId(null);
  }, [selectedAgentId]);

  // Load workspace scripts + workflows so the `$` and `~` quick-actions can
  // list them.
  useEffect(() => {
    void loadScripts(session.workspaceId);
    void loadPhaseTemplates(session.workspaceId);
  }, [session.workspaceId, loadScripts, loadPhaseTemplates]);

  // Load this session's agents so the `@` quick-action can list them.
  useEffect(() => {
    void loadPhaseRunsForSession(session.id);
  }, [session.id, loadPhaseRunsForSession]);

  // Script results are session-scoped — drop them when the session changes.
  useEffect(() => {
    setScriptResult(null);
  }, [session.id]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (
      popoverOpen &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown' || event.key === 'Tab')
    ) {
      event.preventDefault();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !popoverOpen) {
      event.preventDefault();
      void onSend();
    }
  };

  const sendDisabledTitle = providerDisconnected ? 'sign in first' : undefined;
  const overrideDisabledTitle = !allowOverride
    ? 'override disabled in session settings'
    : undefined;

  const providerCandidates: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

  const modelCandidates = useMemo<ReadonlyArray<string>>(() => {
    const ids = new Set(providerModels.map((m) => m.id));
    if (effectiveModel) ids.add(effectiveModel);
    return Array.from(ids);
  }, [providerModels, effectiveModel]);

  const rightSizeSuggested = useMemo<string | null>(() => {
    if (!isFirstTurnForAgent || rightSizeDismissed) return null;
    const weight = assessTurnWeight(value);
    if (weight !== 'light') return null;
    return suggestLighterModel(effectiveModel, modelCandidates);
  }, [isFirstTurnForAgent, rightSizeDismissed, value, effectiveModel, modelCandidates]);

  useEffect(() => {
    if (rightSizePending !== null && rightSizeSuggested === null) {
      setRightSizePending(null);
    }
  }, [rightSizePending, rightSizeSuggested]);

  // Priority-ranked suggestions, folded into one stack so a pile of nudges
  // can't shove the composer below the fold (plan §D.1). Order: plan-ready >
  // scope-mismatch > right-size. RoutingIndicator stays outside — it's a
  // status line, not an action card.
  const suggestions: { readonly key: string; readonly node: ReactNode }[] = [];
  if (sessionNudge?.kind === 'plan-ready' && !session.workflowId) {
    suggestions.push({
      key: 'plan-ready',
      node: (
        <NudgeCard
          severity="success"
          ariaLabel="plan ready to implement"
          testId="plan-ready-nudge"
          icon={<ClipboardCheck size={12} aria-hidden />}
          title={
            <>
              Plan looks ready: <strong>{sessionNudge.planTitle}</strong>. Spawn an implementer to
              execute it?
            </>
          }
          primary={{
            label: 'Spawn implementer',
            onClick: () => void acceptSessionNudgeHandoff(session.id),
            testId: 'plan-ready-accept',
          }}
          secondary={{
            label: 'Not now',
            onClick: () => void dismissSessionNudge(session.id, 'dismissed'),
            testId: 'plan-ready-dismiss',
          }}
          onDismiss={() => void dismissSessionNudge(session.id, 'dismissed')}
        />
      ),
    });
  }
  if (scopePending !== null && activeAgentKind !== null) {
    suggestions.push({
      key: 'scope',
      node: (
        <NudgeCard
          severity="warning"
          ariaLabel="scope mismatch suggestion"
          testId="scope-mismatch-nudge"
          title={
            <>
              you're on <strong>{AGENT_KIND_META[activeAgentKind].label.toLowerCase()}</strong>.
              this request fits{' '}
              <strong>
                {AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()}
              </strong>{' '}
              better.
            </>
          }
          body={
            <>
              spawn a{' '}
              {AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()} agent,
              or send anyway.
            </>
          }
          primary={{
            label: `spawn ${AGENT_KIND_META[scopePending.mismatch.suggestedAgentKind].label.toLowerCase()}`,
            onClick: () => void onScopeSpawn(),
            testId: 'scope-mismatch-spawn',
          }}
          secondary={{
            label: 'send anyway',
            onClick: () => void onScopeSendAnyway(),
            testId: 'scope-mismatch-override',
          }}
          onDismiss={() => void onScopeDismiss()}
        />
      ),
    });
  }
  if (rightSizePending !== null && rightSizeSuggested !== null) {
    suggestions.push({
      key: 'right-size',
      node: (
        <RightSizeCard
          currentModel={effectiveModel}
          suggestedModel={rightSizeSuggested}
          onUseSuggested={() => void onUseSuggested()}
          onKeepCurrent={() => void onKeepCurrent()}
          onChangeModel={onChangeModel}
        />
      ),
    });
  }

  return (
    <div className="px-10 pb-4 pt-2">
      <div className="mx-auto flex w-full max-w-[880px] flex-col gap-2">
        {!isRunning && !providerDisconnected ? (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routingOverride}
            connectedProviders={connectedProviderIds}
            onSendAnyway={value.trim().length > 0 ? () => void onSend() : undefined}
          />
        ) : null}
        <SuggestionStack items={suggestions} />
        {scriptResult ? (
          <ScriptResultRow state={scriptResult} onDismiss={() => setScriptResult(null)} />
        ) : null}
        <div
          className="flex flex-col rounded-[6px] bg-subtle/80 ring-1 ring-border-soft transition-shadow focus-within:ring-foreground/15 dark:bg-muted/40"
          style={{ boxShadow: '0 8px 32px -16px oklch(0 0 0 / 0.25)' }}
        >
          <div className="relative" ref={wrapperRef}>
            {popoverOpen ? (
              <QuickActionsPopover
                items={filteredQuickItems}
                emptyHint={quickEmptyHint}
                onSelect={onQuickActionSelect}
                onDismiss={dismissPopover}
              />
            ) : null}
            <Textarea
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={
                providerDisconnected
                  ? 'Sign in to send a message.'
                  : isRunning
                    ? queued
                      ? 'Message queued. Type to replace.'
                      : 'Turn running. Type to queue next message.'
                    : CHAT_PLACEHOLDER
              }
              disabled={providerDisconnected}
              autoGrow
              maxRows={12}
              className="min-h-20 resize-none border-0 bg-transparent px-4 pt-3 pb-2 pr-12 text-sm leading-relaxed shadow-none placeholder:text-muted-foreground/60 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
            />
            {isRunning && value.trim().length === 0 ? (
              <button
                type="button"
                onClick={() => void cancelCurrentTurn(session.id)}
                title="cancel turn"
                aria-label="cancel turn"
                className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-danger/10 text-danger transition-colors hover:bg-danger/20"
              >
                <Square size={14} aria-hidden fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onSend()}
                disabled={!canSend}
                title={sendDisabledTitle ?? (isRunning ? 'queue message (enter)' : 'send (enter)')}
                aria-label={isRunning ? 'queue message' : 'send message'}
                className="absolute bottom-2.5 right-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/40 disabled:shadow-none"
              >
                <Send size={14} aria-hidden className="-translate-x-px" />
              </button>
            )}
          </div>
          <Divider />
          <div className="flex items-center justify-between gap-2 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <PermissionModePicker session={session} />
              {queued ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-2xs text-primary">
                  queued
                  <button
                    type="button"
                    onClick={() => {
                      setQueued(null);
                      setValue(queued.content);
                    }}
                    title="cancel queued message (returns to input)"
                    aria-label="cancel queued message"
                    className="rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <X size={10} aria-hidden />
                  </button>
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <ProviderUsagePill provider={effectiveProvider} />
              <ModelPicker
                providers={providerCandidates}
                models={modelCandidates}
                provider={effectiveProvider}
                model={effectiveModel}
                effort={effort}
                verbosity={verbosity}
                connectedProviders={connectedProviderIds}
                disabled={!allowOverride || isRunning}
                disabledTitle={overrideDisabledTitle}
                onSelectProvider={onSelectProvider}
                onSelectModel={onSelectModel}
                onSelectEffort={setEffort}
                onSelectVerbosity={setVerbosity}
              />
            </div>
          </div>
        </div>
        {error ? (
          <div role="alert" className="flex items-center gap-2">
            <p className="flex-1 text-xs text-danger">{error}</p>
            {lastFailedTurn !== null ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  void dispatchTurn(lastFailedTurn.content, lastFailedTurn.override);
                }}
                className="shrink-0 rounded border border-danger/30 bg-danger/5 px-2 py-0.5 text-xs font-medium text-danger hover:bg-danger/15"
              >
                retry
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Renders the top-priority suggestion; any others fold behind a counter so
// the stack never grows tall enough to push the composer below the fold.
function SuggestionStack({
  items,
}: {
  items: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;
  const [top, ...rest] = items;
  if (!top) return null;

  return (
    <div className="flex flex-col gap-2">
      {top.node}
      {expanded ? rest.map((it) => <div key={it.key}>{it.node}</div>) : null}
      {rest.length > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          {expanded
            ? 'show fewer suggestions'
            : `+${rest.length} more suggestion${rest.length === 1 ? '' : 's'}`}
        </button>
      ) : null}
    </div>
  );
}
