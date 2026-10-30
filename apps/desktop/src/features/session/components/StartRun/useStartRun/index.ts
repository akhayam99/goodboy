import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { AutoLevel } from '@goodboy/core';
import type {
  ClaudePermissionMode,
  Session,
  SessionId,
  Workflow,
  WorkflowAutonomy,
  WorkspaceId,
} from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { createLatestOnly } from '../../../../../store/runtime/state-writes/latestOnly';
import { agentKindPalette, visibleAgentKinds, type AgentKind } from '../../../agent-kind';
import { useStartFromDraft } from '../../SessionKickoff/useStartFromDraft';
import { roleRunOf } from '../../../startRun/roleRunOf';
import { AUTO_RUN_AS, runAsRouteOf, type RunAs } from '../../../startRun/runAsOf';
import { RUN_ROUTE_COPY } from '../../../startRun/runRouteCopy';
import type { RunRouteFacts, RunRouteResult } from '../../../startRun/runRouteOf';
import { usePromptFiles } from '../../../../../shared/hooks/usePromptFiles';
import { toAttachmentInputs } from '../../../../attachments/pendingAttachment';
import { applyStartEdits } from '../../../startRun/applyStartEdits';
import { runAutonomyOf } from '../../../../workflows/runAutonomy';
import { runDefaultOf } from '../../../startRun/runDefaultOf';
import { runDefaultKey } from '../../../startRun/runDefaultSetting';
import { startRoutedRun } from '../../../startRun/startRoutedRun';
import type { StartLimit } from '../../../../auto/startLimitOf';
import {
  agentRoutingOfPin,
  orchestratorRoutingOfPin,
  type RunModelPin,
} from '../../../startRun/runModelPin';
import {
  AUTO_AGENT_SLOT,
  runModelSlotOf,
  type RunModelSlot,
} from '../../../startRun/runModelSlotOf';
import { useAutoLevel } from '../../../../../shared/hooks/useAutoLevel';
import { useRunModel, type RunModelModel } from '../useRunModel';
import type { IssueCandidate } from '../../../../integrations/fetchIssueCandidates';
import type { SessionDraftMount } from '../../../../../store/slices/sessionDraft/startSessionFromDraft';
import { askWithFileOf } from '../../../startRun/askWithFileOf';
import { draftStartOf } from '../../../startRun/draftStartOf';
import { rememberLastStart } from '../../../startKind/rememberLastStart';
import type { StartRunFile } from '../../../startRun/startRunFileOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly prepare: () => Promise<StartLimit>;
  readonly mount?: SessionDraftMount | null;
  readonly role?: AgentKind | null;
  readonly onStarted?: () => void;
};

export type StartRunModel = Readonly<{
  text: string;
  setText: (text: string) => void;
  discard: () => void;
  file: StartRunFile | null;
  setFile: (file: StartRunFile | null) => void;
  start: () => Promise<void>;
  isStarting: boolean;
  error: string | null;
  runAs: RunAs;
  setRunAs: (runAs: RunAs) => void;
  route: RunRouteResult;
  level: AutoLevel;
  workspaceLevel: AutoLevel;
  pickedLevel: AutoLevel | null;
  setLevel: (level: AutoLevel) => void;
  autonomy: WorkflowAutonomy;
  setAutonomy: (autonomy: WorkflowAutonomy) => void;
  edits: ClaudePermissionMode | null;
  setEdits: (edits: ClaudePermissionMode) => void;
  model: RunModelModel;
  presets: ReadonlyArray<Workflow>;
  files: ReturnType<typeof usePromptFiles>['files'];
  filesNotice: string | null;
}>;

const NO_WORKFLOWS: ReadonlyArray<Workflow> = [];

const NO_ISSUES: ReadonlyArray<IssueCandidate> = [];

const DRAFT_KEY = 'draft';

type AskedParams = {
  readonly asked: string;
};

type FactsParams = {
  readonly text: string;
  readonly workspaceId: WorkspaceId;
  readonly session: Session | null;
  readonly fileCount: number;
  readonly hasPickedTask: boolean;
  readonly presets: ReadonlyArray<Workflow>;
  readonly settings: Readonly<Record<string, string | undefined>>;
};

const factsOf = ({
  text,
  workspaceId,
  session,
  fileCount,
  hasPickedTask,
  presets,
  settings,
}: FactsParams): RunRouteFacts => {
  const state = useAppStore.getState();
  const sessionId = session?.id ?? null;
  const lastPresetRun = [...(session?.workflowRuns ?? [])]
    .reverse()
    .find((run) => run.executionMode !== 'dynamic');
  const pr = sessionId === null ? null : (state.sessionGithub[sessionId]?.pr ?? null);
  return {
    text,
    presets,
    roles: visibleAgentKinds()
      .filter((kind) => kind !== 'auto')
      .map((kind) => ({ kind, label: agentKindPalette({ kind }).label })),
    lastPresetId: lastPresetRun?.workflowId ?? null,
    defaultShape: runDefaultOf({ settings, workspaceId, sessionId }),
    hasTask:
      hasPickedTask ||
      (sessionId !== null && (state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY).length > 0),
    mountCount: sessionId === null ? 0 : (state.sessionProjectMounts?.[sessionId] ?? []).length,
    pullRequest:
      pr === null || pr.state !== 'open'
        ? null
        : {
            number: pr.number,
            isFailing: pr.checks === 'failure',
            hasComments: pr.reviewDecision === 'changes_requested',
          },
    fileCount,
  };
};

type PinnedParams = {
  readonly result: RunRouteResult;
  readonly pin: RunModelPin | null;
};

const pinnedRoutingOf = ({ result, pin }: PinnedParams) => {
  if (pin === null) {
    return {};
  }
  return result.route.shape === 'plan'
    ? { orchestratorRouting: orchestratorRoutingOfPin({ pin }) }
    : { routing: agentRoutingOfPin({ pin }) };
};

export const useStartRun = ({
  workspaceId,
  sessionId,
  prepare,
  mount = null,
  role = null,
  onStarted,
}: Params): StartRunModel => {
  const [localText, setLocalText] = useState('');
  const draftText = useAppStore((state) =>
    sessionId === null ? selectSessionDraft({ state, workspaceId }).workflowGoal : '',
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const text = sessionId === null ? draftText : localText;
  const setText = useCallback(
    (next: string): void => {
      if (sessionId === null) {
        patchSessionDraft({ workspaceId, patch: { workflowGoal: next } });
        return;
      }
      setLocalText(next);
    },
    [patchSessionDraft, sessionId, workspaceId],
  );
  const discardSessionDraft = useAppStore((state) => state.discardSessionDraft);
  const discard = useCallback((): void => {
    if (sessionId === null) {
      discardSessionDraft({ workspaceId });
      return;
    }
    setLocalText('');
  }, [discardSessionDraft, sessionId, workspaceId]);
  const [file, setFile] = useState<StartRunFile | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runAs, setRunAs] = useState<RunAs>(AUTO_RUN_AS);
  const [pickedLevel, setPickedLevel] = useState<AutoLevel | null>(null);
  const [pickedAutonomy, setPickedAutonomy] = useState<WorkflowAutonomy | null>(null);
  const [pickedEdits, setPickedEdits] = useState<ClaudePermissionMode | null>(null);
  const draftAutonomy = useAppStore((state) =>
    sessionId === null ? selectSessionDraft({ state, workspaceId }).autonomy : null,
  );
  const draftEdits = useAppStore((state) =>
    sessionId === null ? selectSessionDraft({ state, workspaceId }).permissionMode : null,
  );
  const autonomyPick = sessionId === null ? draftAutonomy : pickedAutonomy;
  const edits = sessionId === null ? draftEdits : pickedEdits;
  const setAutonomy = useCallback(
    (next: WorkflowAutonomy): void => {
      if (sessionId === null) {
        patchSessionDraft({ workspaceId, patch: { autonomy: next } });
        return;
      }
      setPickedAutonomy(next);
    },
    [patchSessionDraft, sessionId, workspaceId],
  );
  const setEdits = useCallback(
    (next: ClaudePermissionMode): void => {
      if (sessionId === null) {
        patchSessionDraft({ workspaceId, patch: { permissionMode: next } });
        return;
      }
      setPickedEdits(next);
    },
    [patchSessionDraft, sessionId, workspaceId],
  );
  const { level: appliedLevel, workspaceLevel } = useAutoLevel({ workspaceId, sessionId });
  const promptFiles = usePromptFiles({ note: RUN_ROUTE_COPY.attachFiles, isEnabled: !isStarting });
  const { attachments: stagedFiles, setAttachments: setStagedFiles } = promptFiles;
  const clearFilesRef = useRef(promptFiles.clear);
  clearFilesRef.current = promptFiles.clear;
  const templates = useAppStore((state) => state.phaseTemplates[workspaceId]);
  const workspaceDefaultKey = runDefaultKey({ scope: { kind: 'workspace', workspaceId } });
  const sessionDefaultKey =
    sessionId === null ? null : runDefaultKey({ scope: { kind: 'session', sessionId } });
  const workspaceDefaultRaw = useAppStore((state) => state.settings[workspaceDefaultKey]);
  const sessionDefaultRaw = useAppStore((state) =>
    sessionDefaultKey === null ? undefined : state.settings[sessionDefaultKey],
  );
  const settings = useMemo(
    () => ({
      [workspaceDefaultKey]: workspaceDefaultRaw,
      ...(sessionDefaultKey !== null && { [sessionDefaultKey]: sessionDefaultRaw }),
    }),
    [sessionDefaultKey, sessionDefaultRaw, workspaceDefaultKey, workspaceDefaultRaw],
  );
  const sessionRow = useAppStore((state) =>
    sessionId === null ? null : (sessionById(state.sessions, sessionId) ?? null),
  );
  const pickedCount = useAppStore((state) =>
    sessionId === null ? selectSessionDraft({ state, workspaceId }).pickedIssues.length : 0,
  );
  const presets = useMemo(
    () => (templates ?? NO_WORKFLOWS).filter((workflow) => workflow.isPreset === true),
    [templates],
  );
  const route = useMemo(() => {
    const asked = text.trim();
    if (role !== null) {
      return roleRunOf({ text: asked, role });
    }
    return runAsRouteOf({
      runAs,
      facts: factsOf({
        text: asked,
        workspaceId,
        session: sessionRow,
        fileCount: file === null ? 0 : 1,
        hasPickedTask: pickedCount > 0,
        presets,
        settings,
      }),
    });
  }, [file, pickedCount, presets, role, runAs, sessionRow, settings, text, workspaceId]);
  const slot = useMemo(
    (): RunModelSlot => (role === null ? runModelSlotOf({ result: route }) : AUTO_AGENT_SLOT),
    [role, route],
  );
  const model = useRunModel({ workspaceId, sessionId, slot });
  const { clear: clearModel, pinFor } = model;
  const isStartingRef = useRef(false);
  const startFromDraft = useStartFromDraft();
  const latestRef = useRef(createLatestOnly());

  useEffect(() => {
    const latest = latestRef.current;
    return () => {
      latest.cancel({ key: DRAFT_KEY });
      isStartingRef.current = false;
      setLocalText('');
      setFile(null);
      setRunAs(AUTO_RUN_AS);
      setPickedLevel(null);
      setPickedAutonomy(null);
      setPickedEdits(null);
      clearModel();
      clearFilesRef.current();
      setError(null);
      setIsStarting(false);
    };
  }, [clearModel, sessionId, workspaceId]);

  const clearAsked = useCallback(
    ({ asked }: AskedParams) => {
      if (sessionId !== null) {
        setLocalText((current) => (current.trim() === asked ? '' : current));
        return;
      }
      const drafts = useAppStore.getState().sessionDrafts;
      if (drafts[workspaceId]?.workflowGoal.trim() === asked) {
        patchSessionDraft({ workspaceId, patch: { workflowGoal: '' } });
      }
    },
    [patchSessionDraft, sessionId, workspaceId],
  );

  const start = useCallback(async (): Promise<void> => {
    const asked = text.trim();
    if (asked === '' || isStartingRef.current) {
      return;
    }
    const claim = latestRef.current.claim({ key: DRAFT_KEY });
    isStartingRef.current = true;
    setIsStarting(true);
    setError(null);
    try {
      const limit = await prepare();
      const { loadSetting } = useAppStore.getState();
      await Promise.all([
        loadSetting(runDefaultKey({ scope: { kind: 'workspace', workspaceId } })),
        ...(sessionId === null
          ? []
          : [loadSetting(runDefaultKey({ scope: { kind: 'session', sessionId } }))]),
      ]);
      const session =
        sessionId === null
          ? null
          : (sessionById(useAppStore.getState().sessions, sessionId) ?? null);
      const picked =
        sessionId === null
          ? selectSessionDraft({ state: useAppStore.getState(), workspaceId }).pickedIssues
          : NO_ISSUES;
      const state = useAppStore.getState();
      const routed =
        role === null
          ? runAsRouteOf({
              runAs,
              facts: factsOf({
                text: asked,
                workspaceId,
                session,
                fileCount: file === null ? 0 : 1,
                hasPickedTask: picked.length > 0,
                presets: (state.phaseTemplates[workspaceId] ?? NO_WORKFLOWS).filter(
                  (workflow) => workflow.isPreset === true,
                ),
                settings: state.settings,
              }),
            })
          : roleRunOf({ text: asked, role });
      const staged = stagedFiles;
      const attachments = await toAttachmentInputs(staged);
      const result =
        file === null
          ? routed
          : {
              ...routed,
              ask: askWithFileOf({
                ask: routed.ask,
                relPath: file.relPath,
                absolutePath: file.absolutePath,
              }),
            };
      const pin: RunModelPin | null =
        role === null ? pinFor({ slot: runModelSlotOf({ result }) }) : null;
      const pinned = pinnedRoutingOf({ result, pin });
      const editsNow =
        sessionId === null
          ? selectSessionDraft({ state, workspaceId }).permissionMode
          : pickedEdits;
      const autonomyNow =
        result.route.shape === 'plan' && autonomyPick !== null ? autonomyPick : null;
      const run = async (created: Session): Promise<void> => {
        await applyStartEdits({ sessionId: created.id, mode: editsNow });
        await startRoutedRun({
          sessionId: created.id,
          result,
          attachments,
          level: pickedLevel,
          autonomy: autonomyNow,
          limit,
          ...pinned,
        });
      };
      await (sessionId === null
        ? startFromDraft({
            workspaceId,
            start: draftStartOf({ picked, mount, ask: result.ask, run }),
          })
        : applyStartEdits({ sessionId, mode: editsNow }).then(() =>
            startRoutedRun({
              sessionId,
              result,
              attachments,
              level: pickedLevel,
              autonomy: autonomyNow,
              limit,
              ...pinned,
            }),
          ));
      if (sessionId === null) {
        rememberLastStart({ workspaceId, last: 'auto' });
      }
      if (claim.isCurrent()) {
        clearAsked({ asked });
        setFile((current) => (current === file ? null : current));
        setRunAs(AUTO_RUN_AS);
        setPickedLevel(null);
        setPickedAutonomy(null);
        setPickedEdits(null);
        clearModel();
        setStagedFiles((current) => (current === staged ? [] : current));
        onStarted?.();
      }
    } catch (cause) {
      if (claim.isCurrent()) {
        setError(formatError(cause));
      }
    } finally {
      if (claim.isCurrent()) {
        isStartingRef.current = false;
        setIsStarting(false);
      }
    }
  }, [
    clearAsked,
    autonomyPick,
    clearModel,
    file,
    mount,
    onStarted,
    pickedLevel,
    pickedEdits,
    pinFor,
    prepare,
    role,
    runAs,
    sessionId,
    setStagedFiles,
    stagedFiles,
    startFromDraft,
    text,
    workspaceId,
  ]);

  return {
    text,
    setText,
    discard,
    file,
    setFile,
    start,
    isStarting,
    error,
    runAs,
    setRunAs,
    route,
    level: pickedLevel ?? appliedLevel,
    workspaceLevel,
    pickedLevel,
    setLevel: setPickedLevel,
    autonomy: runAutonomyOf({
      autoRun: sessionRow?.autoRun ?? false,
      ...(autonomyPick !== null && { autonomy: autonomyPick }),
    }).key,
    setAutonomy,
    edits,
    setEdits,
    model,
    presets,
    files: promptFiles.files,
    filesNotice: promptFiles.notice,
  };
};
