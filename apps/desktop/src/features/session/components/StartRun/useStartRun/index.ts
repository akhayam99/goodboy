import { useCallback, useEffect, useRef, useState } from 'react';
import { formatError } from '@goodboy/ui';
import type { Session, SessionId, Workflow, WorkspaceId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import { selectSessionDraft } from '../../../../../store/slices/sessionDraft/selectSessionDraft';
import { sessionById } from '../../../../../store/slices/sessions/sessionIndex';
import { createLatestOnly } from '../../../../../store/slices/state-writes/latestOnly';
import { agentKindPalette, visibleAgentKinds } from '../../../agent-kind';
import { useStartFromDraft } from '../../SessionKickoff/useStartFromDraft';
import { runRouteOf, type RunRouteFacts } from '../../../startRun/runRouteOf';
import { runDefaultOf } from '../../../startRun/runDefaultOf';
import { runDefaultKey } from '../../../startRun/runDefaultSetting';
import { startRoutedRun } from '../../../startRun/startRoutedRun';
import type { IssueCandidate } from '../../../../integrations/fetchIssueCandidates';
import type { SessionDraftMount } from '../../../../../store/slices/sessionDraft/startSessionFromDraft';
import { askWithFileOf } from '../../../startRun/askWithFileOf';
import type { StartRunFile } from '../../../startRun/startRunFileOf';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly prepare: () => Promise<void>;
  readonly mount?: SessionDraftMount | null;
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
};

const factsOf = ({
  text,
  workspaceId,
  session,
  fileCount,
  hasPickedTask,
}: FactsParams): RunRouteFacts => {
  const state = useAppStore.getState();
  const sessionId = session?.id ?? null;
  const presets = (state.phaseTemplates[workspaceId] ?? NO_WORKFLOWS).filter(
    (workflow) => workflow.isPreset === true,
  );
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
    defaultShape: runDefaultOf({ settings: state.settings, workspaceId, sessionId }),
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

export const useStartRun = ({
  workspaceId,
  sessionId,
  prepare,
  mount = null,
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
      setError(null);
      setIsStarting(false);
    };
  }, [sessionId, workspaceId]);

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
      await prepare();
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
      const routed = runRouteOf({
        facts: factsOf({
          text: asked,
          workspaceId,
          session,
          fileCount: file === null ? 0 : 1,
          hasPickedTask: picked.length > 0,
        }),
      });
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
      const run = async (created: Session): Promise<void> => {
        await startRoutedRun({ sessionId: created.id, result });
      };
      const [firstTask] = picked;
      await (sessionId === null
        ? startFromDraft({
            workspaceId,
            start:
              firstTask === undefined
                ? { kind: 'workflow-run', goal: result.ask, run }
                : {
                    kind: 'task',
                    candidates: picked,
                    ...(mount !== null && { mount }),
                    title: firstTask.title,
                    goal: result.ask,
                    then: { kind: 'workflow-run', run },
                  },
          })
        : startRoutedRun({ sessionId, result }));
      if (claim.isCurrent()) {
        clearAsked({ asked });
        setFile((current) => (current === file ? null : current));
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
  }, [clearAsked, file, mount, prepare, sessionId, startFromDraft, text, workspaceId]);

  return { text, setText, discard, file, setFile, start, isStarting, error };
};
