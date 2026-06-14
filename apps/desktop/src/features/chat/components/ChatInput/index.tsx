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
import { Clock, Paperclip, Send, Square, Telescope, X } from 'lucide-react';
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
import type { DraftAttachment } from '../../../../store/slices/agents/setAgentAttachments';
import {
  readDroppedAttachment,
  readAttachment,
  writeAttachment,
  deleteAttachment,
} from '../../turn';
import { formatError } from '../../../../shared/lib/errors';
import { RoutingIndicator } from '../RoutingIndicator';
import { useToast, type ToastKind } from '../../../../app/components/Toast';
import {
  QuickActionsPopover,
  buildAgentActions,
  buildScriptActions,
  buildSkillActions,
  buildWorkflowActions,
  parseQuery,
  type QuickActionItem,
} from '../../../quick-actions';
import { type VerbosityLevel } from '../../../../features/settings/verbosity';
import {
  EFFORT_LEVELS,
  type EffortLevel,
  clampEffort,
  suggestHeavierModel,
  suggestLighterModel,
} from '../../utils/chat-constants';
import { ProviderUsagePill } from '../ProviderUsagePill';
import { ModelPicker } from '../ModelPicker';
import { PermissionModePicker } from '../../../../features/permissions/components/PermissionModePicker';
import { RightSizeCard } from '../RightSizeCard';
import { ImageLightbox } from '../ImageLightbox';
import {
  ATTACHMENT_ACCEPT,
  attachmentKindFor,
  fileIconFor,
  isAllowedAttachment,
  resolveAttachmentMime,
} from '../../attachment-kinds';
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

const CHAT_PREFIX_RE = /^\s*[$/~@][^\s]*$/;

const CHAT_PLACEHOLDER = 'Message Claude · $ scripts · ~ workflows · @ agents';

const VALID_PROVIDERS: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const ATTACHMENT_LIMIT = 10;

type PendingAttachment = {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly dataUrl: string;
  readonly relPath: string | null;
};

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
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('unexpected file reader result'));
      }
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

type Props = {
  readonly session: Session;
  readonly providerDisconnected?: boolean;
};

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

export const ChatInput = ({ session, providerDisconnected = false }: Props) => {
  const sendTurn = useAppStore((s) => s.sendTurn);
  const cancelCurrentTurn = useAppStore((s) => s.cancelCurrentTurn);
  const storeSetAgentVerbosity = useAppStore((s) => s.setAgentVerbosity);
  const storeSetSessionConfig = useAppStore((s) => s.setSessionConfig);
  const storeSetAgentConfig = useAppStore((s) => s.setAgentConfig);
  const storeSetAgentEffortOverride = useAppStore((s) => s.setAgentEffortOverride);
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
  const sessionAgentKindOverrides = useAppStore((s) => s.agentKindOverride);
  const selectedAgentName = useAppStore((s) => {
    if (!selectedAgentId) {
      return null;
    }
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
      if (!selectedAgentId) {
        return;
      }
      if (next.length === 0) {
        clearAgentDraft(selectedAgentId);
      } else {
        setAgentDraft(selectedAgentId, next);
      }
    },
    [selectedAgentId, setAgentDraft, clearAgentDraft],
  );

  const [error, setError] = useState<string | null>(null);
  type FailedTurn = {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly override: TurnProviderOverride | undefined;
  };
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
  const wrapperRef = useRef<HTMLDivElement>(null);

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
  type QueuedTurn = {
    readonly id: string;
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly override: TurnProviderOverride | undefined;
  };
  const [queue, setQueue] = useState<ReadonlyArray<QueuedTurn>>([]);
  type RightSizePending = {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
  };
  const [rightSizePending, setRightSizePending] = useState<RightSizePending | null>(null);
  const [rightSizeDismissed, setRightSizeDismissed] = useState(false);
  type ScopePending = {
    readonly content: string;
    readonly attachments: ReadonlyArray<PendingAttachment>;
    readonly mismatch: ScopeMismatch;
  };
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
  const effectiveModel =
    selectedModel ??
    (effectiveProvider === defaultProvider ? defaultModel : getDefaultTurnModel(effectiveProvider));
  const effectiveEffort = clampEffort(effectiveModel, effort);

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
    (script: WorkspaceScript) => {
      if (!sessionWorktree) {
        showToast('warning', `${script.name}, open a session worktree to run scripts`);
        return;
      }
      setValue('');
      setShowPopover(false);
      void runScript(session.id, script.id, sessionWorktree);
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
      return buildWorkflowActions(workspaceWorkflows, (workflow) => void onPickWorkflow(workflow));
    }
    if (symbol === '@') {
      return buildAgentActions(
        sessionAgents,
        sessionAgentKindOverrides,
        onSwitchAgent,
        () => void onSpawnAgent(),
      );
    }
    if (symbol === '/' && WORKSPACE_FEATURES.skills) {
      return buildSkillActions(workspaceSkills, onPickSkill);
    }
    return null;
  }, [
    parsed.prefix,
    workspaceScripts,
    workspaceWorkflows,
    sessionAgents,
    sessionAgentKindOverrides,
    workspaceSkills,
    onPickScript,
    onPickWorkflow,
    onSwitchAgent,
    onSpawnAgent,
    onPickSkill,
  ]);

  const filteredQuickItems = useMemo<ReadonlyArray<QuickActionItem>>(() => {
    if (!quickItems) {
      return EMPTY_ARRAY;
    }
    const q = parsed.query.toLowerCase();
    if (q.length === 0) {
      return quickItems;
    }
    return quickItems.filter(
      (it) =>
        it.label.toLowerCase().includes(q) || (it.sublabel?.toLowerCase().includes(q) ?? false),
    );
  }, [quickItems, parsed.query]);

  const popoverOpen = showPopover && inPrefixMode && quickItems !== null;
  const quickEmptyHint =
    parsed.prefix?.symbol === '$'
      ? 'no scripts yet. add them in workspace settings'
      : parsed.prefix?.symbol === '~'
        ? 'no workflows yet. create one in workspace settings'
        : parsed.prefix?.symbol === '@'
          ? 'no agents in this session yet'
          : 'no skills yet. create one in settings';

  const onQuickActionSelect = useCallback((item: QuickActionItem) => item.perform(), []);
  const dismissPopover = useCallback(() => setShowPopover(false), []);

  const persistAttachmentToDisk = useCallback(
    async (att: {
      readonly id: string;
      readonly fileName: string;
      readonly dataUrl: string;
    }): Promise<string | null> => {
      const worktree = sessionWorktreeRef.current;
      if (!worktree) {
        return null;
      }
      try {
        return await writeAttachment({
          worktreeDir: worktree,
          attachmentId: att.id,
          fileName: att.fileName,
          dataBase64: dataUrlToBase64(att.dataUrl),
        });
      } catch {
        return null;
      }
    },
    [],
  );

  const addFiles = useCallback(
    async (files: ReadonlyArray<File>) => {
      const allowed = files.filter(isAllowedAttachment);
      const skipped = files.length - allowed.length;
      if (skipped > 0) {
        showToast(
          'warning',
          `${skipped} file${skipped === 1 ? '' : 's'} skipped, unsupported type`,
        );
      }
      if (allowed.length === 0) {
        return;
      }
      const accepted: PendingAttachment[] = [];
      for (const file of allowed) {
        if (file.size > MAX_ATTACHMENT_BYTES) {
          showToast('error', `${file.name || 'file'} is over 15MB`);
          continue;
        }
        try {
          const dataUrl = await readFileAsDataUrl(file);
          const mimeType = resolveAttachmentMime(file);
          const id = crypto.randomUUID();
          const fileName = file.name || `pasted-file.${extFromMime(mimeType)}`;
          const relPath = await persistAttachmentToDisk({ id, fileName, dataUrl });
          accepted.push({ id, fileName, mimeType, dataUrl, relPath });
        } catch {
          showToast('error', `could not read ${file.name || 'file'}`);
        }
      }
      if (accepted.length === 0) {
        return;
      }
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
    [showToast, persistAttachmentToDisk],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const onPaste = useCallback(
    (event: ReactClipboardEvent<HTMLTextAreaElement>) => {
      const files = Array.from(event.clipboardData.files).filter(isAllowedAttachment);
      if (files.length > 0) {
        event.preventDefault();
        void addFiles(files);
      }
    },
    [addFiles],
  );

  const onFileInputChange = (event: ReactChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length > 0) {
      void addFiles(files);
    }
    event.target.value = '';
  };

  const setEffort = (level: EffortLevel) => {
    setEffortState(level);
    void storeSetSessionConfig(session.id, { effort: level });
    if (selectedAgentId) {
      void storeSetAgentConfig(session.id, selectedAgentId, { effort: level });
      storeSetAgentEffortOverride(selectedAgentId, level);
    }
  };

  const setVerbosity = (level: VerbosityLevel) => {
    setVerbosityState(level);
    if (selectedAgentId) {
      void storeSetAgentVerbosity(session.id, selectedAgentId, level);
    }
  };

  const setSelectedProvider = (id: ProviderId | null) => {
    setSelectedProviderState(id);
    void storeSetSessionConfig(session.id, { providerOverride: id });
    if (selectedAgentId) {
      void storeSetAgentConfig(session.id, selectedAgentId, { providerOverride: id });
    }
  };

  const setSelectedModel = (id: string | null) => {
    setSelectedModelState(id);
    void storeSetSessionConfig(session.id, { modelOverride: id });
    if (selectedAgentId) {
      void storeSetAgentConfig(session.id, selectedAgentId, { modelOverride: id });
    }
  };

  const onSelectProvider = (id: ProviderId) => {
    if (!connectedProviderIds.includes(id)) {
      window.dispatchEvent(
        new CustomEvent('goodboy:open-provider-studio', { detail: { providerId: id } }),
      );
      return;
    }
    if (!allowOverride || isRunning) {
      return;
    }
    setSelectedProvider(id);
    setSelectedModel(null);
  };

  const onSelectModel = (id: string) => {
    if (!allowOverride || isRunning) {
      return;
    }
    setSelectedModel(id);
  };

  const onResetTurnOverride = () => {
    if (!allowOverride || isRunning) {
      return;
    }
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
            if (!SESSION_FEATURES.budget) {
              return;
            }
            for (const alert of alerts) {
              showToast(toastKindForAlert(alert.kind), toastMessageForAlert(alert));
            }
          },
        });
        setLastFailedTurn(null);
        const sentAgentId = useAppStore.getState().selectedAgentId[session.id] ?? null;
        const worktree = sessionWorktreeRef.current;
        if (worktree) {
          for (const att of atts) {
            if (att.relPath !== null) {
              void deleteAttachment(worktree, att.relPath).catch(() => {});
            }
          }
        }
        if (sentAgentId !== null) {
          useAppStore.getState().clearAgentAttachments(sentAgentId);
        }
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
      setQueue((prev) => [
        ...prev,
        { id: crypto.randomUUID(), content, attachments: atts, override },
      ]);
      return;
    }

    await dispatchTurn(content, atts, override);
  };

  const removeQueued = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const editQueued = useCallback(
    (id: string) => {
      const item = queue.find((q) => q.id === id);
      if (!item) {
        return;
      }
      setQueue((prev) => prev.filter((q) => q.id !== id));
      setValue(item.content);
      setAttachments(item.attachments);
      wrapperRef.current?.querySelector('textarea')?.focus();
    },
    [queue, setValue],
  );

  const onSend = async () => {
    const content = value.trim();
    const atts = attachments;
    if ((!content && atts.length === 0) || providerDisconnected) {
      return;
    }
    setError(null);
    setLastFailedTurn(null);

    if (
      !isRunning &&
      scopePending === null &&
      activeAgentKind !== null &&
      session.workflowRuns.length === 0
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

    if (allowOverride && !isRunning && rightSizeSuggestion !== null && rightSizePending === null) {
      setRightSizePending({ content, attachments: atts });
      return;
    }

    setValue('');
    setAttachments([]);
    await sendWith(content, atts, null);
  };

  const recordScopeOutcome = async (outcome: NudgeOutcome) => {
    if (!scopeNudgeEventId) {
      return;
    }
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
    if (!scopePending) {
      return;
    }
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
    if (!scopePending) {
      return;
    }
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
    if (pending === null) {
      return;
    }
    const suggested = rightSizeSuggestion?.model ?? null;
    setRightSizePending(null);
    setRightSizeDismissed(true);
    setValue('');
    setAttachments([]);
    if (suggested !== null) {
      setSelectedModel(suggested);
    }
    await sendWith(pending.content, pending.attachments, suggested);
  };

  const onKeepCurrent = async () => {
    const pending = rightSizePending;
    if (pending === null) {
      return;
    }
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
    if (wasRun && !isRunning && queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      if (next) {
        void dispatchTurn(next.content, next.attachments, next.override);
      }
    }
  }, [isRunning, queue, dispatchTurn]);

  const providerDisconnectedRef = useRef(providerDisconnected);
  providerDisconnectedRef.current = providerDisconnected;
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;
  const persistAttachmentToDiskRef = useRef(persistAttachmentToDisk);
  persistAttachmentToDiskRef.current = persistAttachmentToDisk;

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | null = null;

    const isInsideComposer = (px: number, py: number): boolean => {
      const el = composerRef.current;
      if (!el) {
        return false;
      }
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
          const id = crypto.randomUUID();
          const dataUrl = `data:${r.mimeType};base64,${r.dataBase64}`;
          const relPath = await persistAttachmentToDiskRef.current({
            id,
            fileName: r.fileName,
            dataUrl,
          });
          dropped.push({
            id,
            fileName: r.fileName,
            mimeType: r.mimeType,
            dataUrl,
            relPath,
          });
        } catch {
          // Unsupported / oversize drops are silently skipped: otherwise a
          // folder drop would spam a toast per child.
        }
      }
      if (dropped.length === 0) {
        return;
      }
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
              setIsDragging(true);
              break;
            case 'leave':
              setIsDragging(false);
              break;
            case 'drop': {
              setIsDragging(false);
              if (!isInsideComposer(p.position.x, p.position.y)) {
                return;
              }
              void ingestDroppedPaths(p.paths);
              break;
            }
          }
        });
        if (cancelled) {
          off();
        } else {
          unlisten = off;
        }
      } catch (err) {
        console.warn('drag-drop listener registration failed:', err);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const lastAgentIdRef = useRef(selectedAgentId);
  const sessionWorktreeRef = useRef(sessionWorktree);
  sessionWorktreeRef.current = sessionWorktree;
  const attachmentsAgentIdRef = useRef<AgentId | null>(null);
  const pendingRestoreAgentRef = useRef<AgentId | null>(selectedAgentId);
  const setAgentAttachments = useAppStore((s) => s.setAgentAttachments);

  const restoreAttachments = useCallback(
    async (draftAttachments: ReadonlyArray<DraftAttachment>, agentId: AgentId) => {
      const worktree = sessionWorktreeRef.current;
      if (!worktree && draftAttachments.length > 0) {
        return;
      }
      const restored: PendingAttachment[] = [];
      if (worktree) {
        for (const att of draftAttachments) {
          try {
            const dataUrl = await readAttachment(worktree, att.relPath);
            restored.push({
              id: att.id,
              fileName: att.fileName,
              mimeType: att.mimeType,
              dataUrl,
              relPath: att.relPath,
            });
          } catch {}
        }
      }
      if (pendingRestoreAgentRef.current !== agentId) {
        return;
      }
      setAttachments(restored);
      attachmentsAgentIdRef.current = agentId;
    },
    [],
  );

  useEffect(() => {
    if (selectedAgentId === null) {
      return;
    }
    if (attachmentsAgentIdRef.current !== selectedAgentId) {
      return;
    }
    const draftAtts: DraftAttachment[] = attachments
      .filter((a): a is PendingAttachment & { relPath: string } => a.relPath !== null)
      .map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        relPath: a.relPath,
      }));
    setAgentAttachments(selectedAgentId, draftAtts);
  }, [attachments, selectedAgentId, setAgentAttachments]);

  useEffect(() => {
    pendingRestoreAgentRef.current = selectedAgentId;
    attachmentsAgentIdRef.current = null;
    if (selectedAgentId === null) {
      setAttachments([]);
      return;
    }
    const stored = useAppStore.getState().agentAttachments[selectedAgentId] ?? [];
    void restoreAttachments(stored, selectedAgentId);
  }, [selectedAgentId, sessionWorktree, restoreAttachments]);

  useEffect(() => {
    if (lastAgentIdRef.current === selectedAgentId) {
      return;
    }
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
    if (restoredEffort !== null) {
      setEffortState(restoredEffort);
    }
    if (restoredVerbosity !== null) {
      setVerbosityState(restoredVerbosity);
    }

    setQueue([]);
    setRightSizePending(null);
    setRightSizeDismissed(false);
    setScopePending(null);
    setScopeNudgeEventId(null);
  }, [selectedAgentId]);

  useEffect(() => {
    void loadScripts(session.workspaceId);
    void loadPhaseTemplates(session.workspaceId);
  }, [session.workspaceId, loadScripts, loadPhaseTemplates]);

  useEffect(() => {
    void loadPhaseRunsForSession(session.id);
  }, [session.id, loadPhaseRunsForSession]);

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

  const providerCandidates: ReadonlyArray<ProviderId> = ['anthropic', 'cursor', 'codex', 'gemini'];

  const modelCandidates = useMemo<ReadonlyArray<string>>(() => {
    const ids = new Set(providerModels.map((m) => m.id));
    if (effectiveModel) {
      ids.add(effectiveModel);
    }
    return Array.from(ids);
  }, [providerModels, effectiveModel]);

  const rightSizeSuggestion = useMemo<{
    readonly direction: 'lighter' | 'heavier';
    readonly model: string;
    readonly kind: 'strong' | 'optional';
    readonly costMultiplier: number | null;
  } | null>(() => {
    if (!isFirstTurnForAgent || rightSizeDismissed) {
      return null;
    }
    const weight = assessTurnWeight(value, { attachmentCount: attachments.length });
    if (weight === 'light') {
      const s = suggestLighterModel(effectiveModel, modelCandidates);
      return s
        ? { direction: 'lighter', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    if (weight === 'heavy') {
      const s = suggestHeavierModel(effectiveModel, modelCandidates);
      return s
        ? { direction: 'heavier', model: s.id, kind: s.kind, costMultiplier: s.costMultiplier }
        : null;
    }
    return null;
  }, [
    isFirstTurnForAgent,
    rightSizeDismissed,
    value,
    effectiveModel,
    modelCandidates,
    attachments,
  ]);

  useEffect(() => {
    if (rightSizePending !== null && rightSizeSuggestion === null) {
      setRightSizePending(null);
    }
  }, [rightSizePending, rightSizeSuggestion]);

  const suggestions: { readonly key: string; readonly node: ReactNode }[] = [];
  if (sessionNudge?.kind === 'plan-ready' && session.workflowRuns.length === 0) {
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
  if (sessionNudge?.kind === 'scout-fanout-suggested') {
    suggestions.push({
      key: 'scout-fanout',
      node: (
        <NudgeCard
          severity="info"
          ariaLabel="multi-scout exploration available"
          testId="scout-fanout-nudge"
          icon={<Telescope size={12} aria-hidden />}
          title={
            <>
              Broad search across <strong>{sessionNudge.areaCount} areas</strong>. Multi-scout can
              explore them in parallel.
            </>
          }
          body={<>Enable it for this workspace to scan large codebases faster.</>}
          primary={{
            label: 'Enable multi-scout',
            onClick: () => {
              window.dispatchEvent(
                new CustomEvent('goodboy:open-workspace-settings', {
                  detail: { section: 'scout' },
                }),
              );
              void dismissSessionNudge(session.id, 'accepted');
            },
            testId: 'scout-fanout-enable',
          }}
          secondary={{
            label: 'Not now',
            onClick: () => void dismissSessionNudge(session.id, 'dismissed'),
            testId: 'scout-fanout-dismiss',
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
  if (rightSizePending !== null && rightSizeSuggestion !== null) {
    suggestions.push({
      key: 'right-size',
      node: (
        <RightSizeCard
          direction={rightSizeSuggestion.direction}
          kind={rightSizeSuggestion.kind}
          costMultiplier={rightSizeSuggestion.costMultiplier}
          currentModel={effectiveModel}
          suggestedModel={rightSizeSuggestion.model}
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
        {!isRunning && !providerDisconnected && (
          <RoutingIndicator
            sessionPreference={session.providerPreference}
            turnOverride={routingOverride}
            connectedProviders={connectedProviderIds}
            onSendAnyway={value.trim().length > 0 ? () => void onSend() : undefined}
          />
        )}
        <SuggestionStack items={suggestions} />
        <QueuedMessages
          items={queue}
          canEdit={value.trim().length === 0 && attachments.length === 0}
          onEdit={editQueued}
          onRemove={removeQueued}
        />
        <div
          ref={composerRef}
          className={`relative flex flex-col rounded-md ring-1 transition-all focus-within:ring-2 focus-within:ring-primary/40 dark:bg-muted/40 ${
            isDragging ? 'bg-primary/5 ring-2 ring-primary' : 'bg-subtle/80 ring-border-soft'
          }`}
        >
          <div
            className={`pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md bg-primary/5 transition-opacity duration-150 ${
              isDragging ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden
          >
            <div
              className={`flex items-center gap-2 rounded-full border border-border-soft bg-background px-4 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/30 transition-transform duration-150 ${
                isDragging ? 'scale-100' : 'scale-95'
              }`}
            >
              <Paperclip size={14} aria-hidden />
              drop to attach
            </div>
          </div>
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 px-3 pb-1 pt-3">
              {attachments.map((a) => (
                <AttachmentChip key={a.id} attachment={a} onRemove={() => removeAttachment(a.id)} />
              ))}
            </div>
          )}
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
                  ? 'Sign in to send a message'
                  : isRunning
                    ? queue.length > 0
                      ? 'Type to queue another message'
                      : 'Turn running, type to queue the next message'
                    : CHAT_PLACEHOLDER
              }
              disabled={providerDisconnected}
              autoGrow
              maxRows={12}
              className="min-h-20 resize-none border-0 bg-transparent px-4 pt-3 pb-2 pr-12 text-sm leading-relaxed text-info shadow-none placeholder:text-muted-foreground/60 focus-visible:border-0 focus-visible:shadow-none focus-visible:ring-0"
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
              <PermissionModePicker session={session} activeProvider={effectiveProvider} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={providerDisconnected}
                title="attach files"
                aria-label="attach files"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Paperclip size={15} aria-hidden />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                className="hidden"
                onChange={onFileInputChange}
              />
              <button
                type="button"
                onClick={() => {
                  onValueChange('$');
                  wrapperRef.current?.querySelector('textarea')?.focus();
                }}
                disabled={providerDisconnected}
                title="run a workspace script"
                aria-label="run a workspace script"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md font-mono text-[13px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                $
              </button>
            </div>
            <div className="flex items-center gap-2">
              <ProviderUsagePill provider={effectiveProvider} />
              <ModelPicker
                providers={providerCandidates}
                models={modelCandidates}
                provider={effectiveProvider}
                model={effectiveModel}
                effort={effectiveEffort}
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
            {lastFailedTurn !== null && (
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
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

type QueuedItem = {
  readonly id: string;
  readonly content: string;
  readonly attachments: ReadonlyArray<PendingAttachment>;
};

function QueuedMessages({
  items,
  canEdit,
  onEdit,
  onRemove,
}: {
  readonly items: ReadonlyArray<QueuedItem>;
  readonly canEdit: boolean;
  readonly onEdit: (id: string) => void;
  readonly onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1 rounded-[6px] bg-subtle/80 p-1 ring-1 ring-border-soft">
      <div className="flex items-center gap-1.5 px-1.5 pt-0.5 text-2xs text-muted-foreground">
        <Clock size={11} aria-hidden />
        <span>
          {items.length === 1
            ? 'queued, sends when the current turn finishes'
            : `${items.length} queued, send in order`}
        </span>
      </div>
      {items.map((item, i) => {
        const trimmed = item.content.trim();
        const attachmentCount = item.attachments.length;
        const preview =
          trimmed.length > 0
            ? trimmed
            : `${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}`;
        return (
          <div
            key={item.id}
            className="group flex items-center gap-2 rounded bg-background/60 px-1.5 py-1"
          >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xs font-medium text-primary">
              {i + 1}
            </span>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => onEdit(item.id)}
              title={canEdit ? 'edit, moves it back to the composer' : 'clear the composer to edit'}
              className="min-w-0 flex-1 truncate text-left text-xs text-foreground/80 transition-colors enabled:hover:text-foreground disabled:cursor-default"
            >
              {preview}
            </button>
            {attachmentCount > 0 && trimmed.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-2xs text-muted-foreground">
                <Paperclip size={10} aria-hidden />
                {attachmentCount}
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              title="remove from queue"
              aria-label="remove queued message"
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
            >
              <X size={11} aria-hidden />
            </button>
          </div>
        );
      })}
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
  const removeButton = (
    <button
      type="button"
      onClick={onRemove}
      title={`remove ${attachment.fileName}`}
      aria-label={`remove ${attachment.fileName}`}
      className="absolute right-0.5 top-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-foreground/70 text-background opacity-0 transition-opacity hover:bg-foreground group-hover:opacity-100"
    >
      <X size={10} aria-hidden />
    </button>
  );

  if (attachmentKindFor(attachment.mimeType) === 'image') {
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
        {removeButton}
      </div>
    );
  }

  const Icon = fileIconFor(attachment.mimeType);
  const isPdf = attachment.mimeType === 'application/pdf';
  return (
    <div className="group relative flex h-16 max-w-[12rem] items-center gap-2 rounded-md bg-background/60 py-2 pl-2.5 pr-6 ring-1 ring-border-soft">
      <button
        type="button"
        disabled={!isPdf}
        onClick={() => setPreviewOpen(true)}
        title={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        aria-label={isPdf ? `preview ${attachment.fileName}` : attachment.fileName}
        className="flex min-w-0 items-center gap-2 enabled:cursor-zoom-in"
      >
        <Icon size={18} aria-hidden className="shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-foreground/80">{attachment.fileName}</span>
      </button>
      {previewOpen && isPdf ? (
        <ImageLightbox
          media="pdf"
          src={`data:application/pdf;base64,${dataUrlToBase64(attachment.dataUrl)}`}
          alt={attachment.fileName}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
      {removeButton}
    </div>
  );
}

function SuggestionStack({
  items,
}: {
  items: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return null;
  }
  const [top, ...rest] = items;
  if (!top) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {top.node}
      {expanded ? rest.map((it) => <div key={it.key}>{it.node}</div>) : null}
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start rounded px-1.5 py-0.5 text-2xs font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
        >
          {expanded
            ? 'show fewer suggestions'
            : `+${rest.length} more suggestion${rest.length === 1 ? '' : 's'}`}
        </button>
      )}
    </div>
  );
}
