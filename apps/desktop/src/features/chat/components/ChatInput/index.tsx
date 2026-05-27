import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ChangeEvent as ReactChangeEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { ImagePlus, Send, Square, X } from 'lucide-react';
import { Divider, Textarea } from '@goodboy/ui';
import type {
  Agent,
  AgentId,
  AttachmentInput,
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
import { readDroppedAttachment } from '../../turn';
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
import { type VerbosityLevel } from '../../../../features/settings/verbosity';
import { EFFORT_LEVELS, type EffortLevel, suggestLighterModel } from '../../utils/chat-constants';
import { ProviderUsagePill } from '../ProviderUsagePill';
import { ModelPicker } from '../ModelPicker';
import { PermissionModePicker } from '../../../../features/permissions/components/PermissionModePicker';
import { RightSizeCard } from '../RightSizeCard';
import { ImageLightbox } from '../ImageLightbox';
import { NudgeCard } from '../NudgeCard';
import { ClipboardCheck } from 'lucide-react';
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

// Idle-state composer placeholder, shows the whole prefix grammar at once
// so the user is taught every quick-action up front, not over time.
const CHAT_PLACEHOLDER = 'Message Claude · $ scripts · ~ workflows · @ agents';

const VALID_PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex'];

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_LIMIT = 10;

interface PendingAttachment {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  /** `data:<mime>;base64,<…>`, drives both the composer preview and the send payload. */
  readonly dataUrl: string;
}

function extFromMime(mimeType: string): string {
  const slash = mimeType.indexOf('/');
  const ext = slash >= 0 ? mimeType.slice(slash + 1) : '';
  return ext.length > 0 && ext.length <= 5 ? ext : 'png';
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('unexpected file reader result'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('file read failed'));
    reader.readAsDataURL(file);
  });
}

function toAttachmentInput(a: PendingAttachment): AttachmentInput {
  return {
    id: a.id,
    fileName: a.fileName,
    mimeType: a.mimeType,
    dataBase64: dataUrlToBase64(a.dataUrl),
  };
}

function asEffortLevel(v: string | undefined | null): EffortLevel | null {
  return v && EFFORT_LEVELS.includes(v as EffortLevel) ? (v as EffortLevel) : null;
}

function asProvider(v: string | undefined | null): ProviderId | null {
  return v && VALID_PROVIDERS.includes(v as ProviderId) ? (v as ProviderId) : null;
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
  const storeSetAgentVerbosity = useAppStore((s) => s.setAgentVerbosity);
  const storeSetSessionConfig = useAppStore((s) => s.setSessionConfig);
  const storeSetAgentConfig = useAppStore((s) => s.setAgentConfig);
  const workspaceDefaultVerbosity = useAppStore(
    (s) => s.workspaceOverrides[session.workspaceId]?.defaultVerbosity ?? null,
  );
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
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly override: TurnProviderOverride | undefined;
  }
  const [lastFailedTurn, setLastFailedTurn] = useState<FailedTurn | null>(null);
  const [attachments, setAttachments] = useState<ReadonlyArray<PendingAttachment>>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const [selectedProvider, setSelectedProviderState] = useState<ProviderId | null>(() =>
    asProvider(session.providerOverride),
  );
  const [selectedModel, setSelectedModelState] = useState<string | null>(
    () => session.modelOverride ?? null,
  );
  const [effort, setEffortState] = useState<EffortLevel>(
    () => asEffortLevel(session.effort) ?? 'medium',
  );
  const [verbosity, setVerbosityState] = useState<VerbosityLevel>(() => {
    const initialAgentId = useAppStore.getState().selectedAgentId[session.id] ?? null;
    const initialRuns = useAppStore.getState().sessionPhaseRuns[session.id] ?? [];
    const agentRow = initialAgentId
      ? (initialRuns.find((r) => r.id === initialAgentId) ?? null)
      : null;
    return (
      (agentRow?.verbosity as VerbosityLevel | undefined) ?? workspaceDefaultVerbosity ?? 'normal'
    );
  });
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
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly override: TurnProviderOverride | undefined;
  }
  const [queued, setQueued] = useState<QueuedTurn | null>(null);
  interface RightSizePending {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
  }
  const [rightSizePending, setRightSizePending] = useState<RightSizePending | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);
  interface ScopePending {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly mismatch: ScopeMismatch;
  }
  const [scopePending, setScopePending] = useState<ScopePending | null>(null);
  const [scopeNudgeEventId, setScopeNudgeEventId] = useState<string | null>(null);
  const canSend = !providerDisconnected && (value.trim().length > 0 || attachments.length > 0);
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
        showToast('warning', `${script.name}, open a session worktree to run scripts`);
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
      const alreadyAttached = new Set(session.workflowIds);
      const eligible = workspaceWorkflows.filter((w) => !alreadyAttached.has(w.id));
      return buildWorkflowActions(eligible, (workflow) => void onPickWorkflow(workflow));
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
    session.workflowIds,
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
        ? session.workflowIds.length > 0
          ? 'all available workflows are already attached.'
          : 'no workflows. create one in workspace settings.'
        : parsed.prefix?.symbol === '@'
          ? 'no agents in this session.'
          : 'no skills. create one in settings.';

  const onQuickActionSelect = useCallback((item: QuickActionItem) => item.perform(), []);
  const dismissPopover = useCallback(() => setShowPopover(false), []);

  const addFiles = useCallback(
    async (files: ReadonlyArray<File>) => {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (images.length === 0) return;
      const accepted: PendingAttachment[] = [];
      for (const file of images) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          showToast('error', `${file.name || 'image'} is over 15MB`);
          continue;
        }
        try {
          const dataUrl = await readFileAsDataUrl(file);
          accepted.push({
            id: crypto.randomUUID(),
            fileName: file.name || `pasted-image.${extFromMime(file.type)}`,
            mimeType: file.type,
            dataUrl,
          });
        } catch {
          showToast('error', `could not read ${file.name || 'image'}`);
        }
      }
      if (accepted.length === 0) return;
      setAttachments((prev) => {
        const room = ATTACHMENT_LIMIT - prev.length;
        if (room <= 0) {
          showToast('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
          return prev;
        }
        if (accepted.length > room) {
          showToast('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
        }
        return [...prev, ...accepted.slice(0, room)];
      });
    },
    [showToast],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const onPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      const images = Array.from(event.clipboardData.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (images.length > 0) {
        event.preventDefault();
        void addFiles(images);
      }
    },
    [addFiles],
  );

  const onFileInputChange = (event: ReactChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) void addFiles(files);
    event.target.value = '';
  };

  const setEffort = (level: EffortLevel) => {
    setEffortState(level);
    void storeSetSessionConfig(session.id, { effort: level });
    if (selectedAgentId) void storeSetAgentConfig(session.id, selectedAgentId, { effort: level });
  };

  const setVerbosity = (level: VerbosityLevel) => {
    setVerbosityState(level);
    if (selectedAgentId) void storeSetAgentVerbosity(session.id, selectedAgentId, level);
  };

  const setSelectedProvider = (id: ProviderId | null) => {
    setSelectedProviderState(id);
    void storeSetSessionConfig(session.id, { providerOverride: id });
    if (selectedAgentId)
      void storeSetAgentConfig(session.id, selectedAgentId, { providerOverride: id });
  };

  const setSelectedModel = (id: string | null) => {
    setSelectedModelState(id);
    void storeSetSessionConfig(session.id, { modelOverride: id });
    if (selectedAgentId)
      void storeSetAgentConfig(session.id, selectedAgentId, { modelOverride: id });
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

  const onResetTurnOverride = () => {
    if (!allowOverride || isRunning) return;
    setSelectedProvider(null);
    setSelectedModel(null);
  };

  const dispatchTurn = useCallback(
    async (
      content: string,
      atts: ReadonlyArray<PendingAttachment>,
      override: TurnProviderOverride | undefined,
    ) => {
      try {
        await sendTurn({
          sessionId: session.id,
          content,
          ...(atts.length > 0 ? { attachments: atts.map(toAttachmentInput) } : {}),
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
        setLastFailedTurn({ content, attachments: atts, override });
      }
    },
    [sendTurn, session.id, showToast],
  );

  const sendWith = async (
    content: string,
    atts: ReadonlyArray<PendingAttachment>,
    modelOverrideId: string | null,
  ) => {
    const useModel = modelOverrideId ?? (modelChanged ? effectiveModel : null);
    const override: TurnProviderOverride | undefined =
      allowOverride && (providerChanged || useModel !== null)
        ? {
            providerId: effectiveProvider,
            ...(useModel !== null ? { model: useModel } : {}),
          }
        : undefined;

    if (isRunning) {
      setQueued({ content, attachments: atts, override });
      return;
    }

    await dispatchTurn(content, atts, override);
  };

  const onSend = async () => {
    const content = value.trim();
    const atts = attachments;
    if ((!content && atts.length === 0) || providerDisconnected) return;
    setError(null);
    setLastFailedTurn(null);

    if (
      !isRunning &&
      scopePending === null &&
      activeAgentKind !== null &&
      session.workflowIds.length === 0
    ) {
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
        setScopePending({ content, attachments: atts, mismatch });
        return;
      }
    }

    if (allowOverride && !isRunning && rightSizeSuggested !== null && rightSizePending === null) {
      setRightSizePending({ content, attachments: atts });
      return;
    }

    setValue('');
    setAttachments([]);
    await sendWith(content, atts, null);
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
      // ignore, user will see standard error path elsewhere
    }
  };

  const onScopeSendAnyway = async () => {
    if (!scopePending) return;
    const content = scopePending.content;
    const atts = scopePending.attachments;
    setScopePending(null);
    setValue('');
    setAttachments([]);
    await recordScopeOutcome('overridden');
    await sendWith(content, atts, null);
  };

  const onScopeDismiss = async () => {
    setScopePending(null);
    await recordScopeOutcome('dismissed');
  };

  const onUseSuggested = async () => {
    const pending = rightSizePending;
    if (pending === null) return;
    const suggested = rightSizeSuggested;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    if (suggested !== null) setSelectedModel(suggested);
    await sendWith(pending.content, pending.attachments, suggested);
  };

  const onKeepCurrent = async () => {
    const pending = rightSizePending;
    if (pending === null) return;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    await sendWith(pending.content, pending.attachments, null);
  };

  const onChangeModel = () => {
    setRightSizePending(null);
    setRightSizeDismissed(true);
  };

  useEffect(() => {
    const wasRun = wasRunning.current;
    wasRunning.current = isRunning;
    if (wasRun && !isRunning && queued) {
      const { content, attachments: queuedAttachments, override } = queued;
      setQueued(null);
      void dispatchTurn(content, queuedAttachments, override);
    }
  }, [isRunning, queued, dispatchTurn]);

  // Native drag-drop. Tauri swallows DOM drop events for OS-file drags by
  // default (dragDropEnabled=true) and emits a window-global event instead.
  // We register the listener ONCE per component lifetime. Refs carry the
  // latest providerDisconnected/showToast so dep churn never tears the
  // listener down mid-drag. Coordinate semantics vary across Tauri builds
  // (some emit physical px, some logical), so the hit-test tries both
  // interpretations against the composer's bounding rect.
  const providerDisconnectedRef = useRef(providerDisconnected);
  providerDisconnectedRef.current = providerDisconnected;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    // Rect-based hit-test, tolerant to whichever coordinate space Tauri
    // emits on this build (physical vs logical px). `elementFromPoint`
    // proved unreliable during an active OS drag: the native drag overlay
    // sits above the DOM and the hit-test returns null.
    const isInsideComposer = (px: number, py: number): boolean => {
      const el = composerRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const candidates: ReadonlyArray<readonly [number, number]> = [
        [px / dpr, py / dpr],
        [px, py],
      ];
      return candidates.some(
        ([x, y]) => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom,
      );
    };

    const ingestDroppedPaths = async (paths: ReadonlyArray<string>) => {
      const dropped: PendingAttachment[] = [];
      for (const path of paths) {
        try {
          const r = await readDroppedAttachment(path);
          dropped.push({
            id: crypto.randomUUID(),
            fileName: r.fileName,
            mimeType: r.mimeType,
            dataUrl: `data:${r.mimeType};base64,${r.dataBase64}`,
          });
        } catch {
          // Non-image / oversize drops are silently skipped: otherwise a
          // folder drop would spam a toast per child.
        }
      }
      if (dropped.length === 0) return;
      setAttachments((prev) => {
        const room = ATTACHMENT_LIMIT - prev.length;
        if (room <= 0) {
          showToastRef.current('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
          return prev;
        }
        if (dropped.length > room) {
          showToastRef.current('warning', `attachment limit is ${ATTACHMENT_LIMIT}`);
        }
        return [...prev, ...dropped.slice(0, room)];
      });
    };

    void (async () => {
      try {
        const off = await getCurrentWebview().onDragDropEvent((event) => {
          const p = event.payload;
          if (providerDisconnectedRef.current) {
            setIsDragging(false);
            return;
          }
          switch (p.type) {
            case 'enter':
            case 'over':
              // Tauri only fires these while the cursor is over our webview,
              // so an unconditional `true` means "drag is happening here".
              // Good enough to highlight the composer as the drop target.
              // We don't gate on hit-test: native drag overlays defeat the
              // DOM, and the user knows there's only one drop zone.
              setIsDragging(true);
              break;
            case 'leave':
              setIsDragging(false);
              break;
            case 'drop': {
              setIsDragging(false);
              if (!isInsideComposer(p.position.x, p.position.y)) return;
              void ingestDroppedPaths(p.paths);
              break;
            }
          }
        });
        if (cancelled) off();
        else unlisten = off;
      } catch (err) {
        // Webview API unavailable in non-Tauri test env. Log so a real
        // failure in dev surfaces in the console instead of being silent.
        console.warn('drag-drop listener registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const lastAgentIdRef = useRef(selectedAgentId);
  useEffect(() => {
    if (lastAgentIdRef.current === selectedAgentId) return;
    const outgoingAgentId = lastAgentIdRef.current;
    lastAgentIdRef.current = selectedAgentId;

    if (outgoingAgentId !== null) {
      void storeSetAgentConfig(session.id, outgoingAgentId, {
        providerOverride: currentProviderRef.current,
        modelOverride: currentModelRef.current,
        effort: currentEffortRef.current,
      });
    }

    const restoredAgent =
      selectedAgentId !== null
        ? (useAppStore.getState().sessionPhaseRuns[session.id] ?? []).find(
            (r) => r.id === selectedAgentId,
          )
        : null;
    const restoredProvider = asProvider(restoredAgent?.providerOverride);
    const restoredModel = restoredAgent?.modelOverride ?? null;
    const restoredEffort = asEffortLevel(restoredAgent?.effort);
    const restoredVerbosity =
      (restoredAgent?.verbosity as VerbosityLevel | undefined) ?? workspaceDefaultVerbosity ?? null;

    setSelectedProviderState(restoredProvider);
    setSelectedModelState(restoredModel);
    if (restoredEffort !== null) setEffortState(restoredEffort);
    if (restoredVerbosity !== null) setVerbosityState(restoredVerbosity);

    setAttachments([]);
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

  // Script results are session-scoped, drop them when the session changes.
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
  // scope-mismatch > right-size. RoutingIndicator stays outside, it's a
  // status line, not an action card.
  const suggestions: { readonly key: string; readonly node: ReactNode }[] = [];
  if (sessionNudge?.kind === 'plan-ready' && session.workflowIds.length === 0) {
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
          ref={composerRef}
          className={`relative flex flex-col rounded-[6px] ring-1 transition-all focus-within:ring-foreground/15 dark:bg-muted/40 ${
            isDragging ? 'bg-primary/5 ring-2 ring-primary' : 'bg-subtle/80 ring-border-soft'
          }`}
          style={{ boxShadow: '0 8px 32px -16px oklch(0 0 0 / 0.25)' }}
        >
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[6px] bg-primary/5 transition-opacity duration-150 ${
              isDragging ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden
          >
            <div
              className={`flex items-center gap-2 rounded-full bg-background/95 px-4 py-1.5 text-xs font-medium text-primary shadow-md ring-1 ring-primary/30 transition-transform duration-150 ${
                isDragging ? 'scale-100' : 'scale-95'
              }`}
            >
              <ImagePlus size={14} aria-hidden />
              drop to attach
            </div>
          </div>
          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-3 pb-1 pt-3">
              {attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
              ))}
            </div>
          ) : null}
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
              onPaste={onPaste}
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
            {isRunning && value.trim().length === 0 && attachments.length === 0 ? (
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
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={providerDisconnected}
                title="attach images"
                aria-label="attach images"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ImagePlus size={15} aria-hidden />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onFileInputChange}
              />
              {queued ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-2xs text-primary">
                  queued
                  <button
                    type="button"
                    onClick={() => {
                      setQueued(null);
                      setValue(queued.content);
                      setAttachments(queued.attachments);
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
                defaultProvider={defaultProvider}
                defaultModel={defaultModel}
                onSelectProvider={onSelectProvider}
                onSelectModel={onSelectModel}
                onSelectEffort={setEffort}
                onSelectVerbosity={setVerbosity}
                onResetToDefault={onResetTurnOverride}
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
                  void dispatchTurn(
                    lastFailedTurn.content,
                    lastFailedTurn.attachments,
                    lastFailedTurn.override,
                  );
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

function AttachmentChip({
  attachment,
  onRemove,
}: {
  readonly attachment: PendingAttachment;
  readonly onRemove: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div className="group relative h-16 w-16 overflow-hidden rounded-md ring-1 ring-border-soft">
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        title={`preview ${attachment.fileName}`}
        aria-label={`preview ${attachment.fileName}`}
        className="block h-full w-full cursor-zoom-in"
      >
        <img
          src={attachment.dataUrl}
          alt={attachment.fileName}
          className="h-full w-full object-cover"
        />
      </button>
      {previewOpen ? (
        <ImageLightbox
          src={attachment.dataUrl}
          alt={attachment.fileName}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        title={`remove ${attachment.fileName}`}
        aria-label={`remove ${attachment.fileName}`}
        className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity hover:bg-foreground group-hover:opacity-100"
      >
        <X size={10} aria-hidden />
      </button>
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
