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
import { startRoutedRun } from '../../../startRun/startRoutedRun';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly sessionId: SessionId | null;
  readonly prepare: () => Promise<void>;
};

export type StartRunModel = Readonly<{
  text: string;
  setText: (text: string) => void;
  start: () => Promise<void>;
  isStarting: boolean;
  error: string | null;
}>;

const NO_WORKFLOWS: ReadonlyArray<Workflow> = [];

const DRAFT_KEY = 'draft';

type AskedParams = {
  readonly asked: string;
};

type FactsParams = {
  readonly text: string;
  readonly workspaceId: WorkspaceId;
  readonly session: Session | null;
};

const factsOf = ({ text, workspaceId, session }: FactsParams): RunRouteFacts => {
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
    defaultShape: 'auto',
    hasTask:
      sessionId !== null && (state.sessionExternalTasks[sessionId] ?? EMPTY_ARRAY).length > 0,
    mountCount: sessionId === null ? 0 : (state.sessionProjectMounts?.[sessionId] ?? []).length,
    pullRequest:
      pr === null || pr.state !== 'open'
        ? null
        : {
            number: pr.number,
            isFailing: pr.checks === 'failure',
            hasComments: pr.reviewDecision === 'changes_requested',
          },
    fileCount: 0,
  };
};

export const useStartRun = ({ workspaceId, sessionId, prepare }: Params): StartRunModel => {
  const [localText, setLocalText] = useState('');
  const draftText = useAppStore(
    (state) =>
      selectSessionDraft({ state, workspaceId: sessionId === null ? workspaceId : null }).runText,
  );
  const patchSessionDraft = useAppStore((state) => state.patchSessionDraft);
  const text = sessionId === null ? draftText : localText;
  const setText = useCallback(
    (next: string) => {
      if (sessionId === null) {
        patchSessionDraft({ workspaceId, patch: { runText: next } });
        return;
      }
      setLocalText(next);
    },
    [patchSessionDraft, sessionId, workspaceId],
  );
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
      if (drafts[workspaceId]?.runText.trim() === asked) {
        patchSessionDraft({ workspaceId, patch: { runText: '' } });
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
      const session =
        sessionId === null
          ? null
          : (sessionById(useAppStore.getState().sessions, sessionId) ?? null);
      const result = runRouteOf({ facts: factsOf({ text: asked, workspaceId, session }) });
      await (sessionId === null
        ? startFromDraft({
            workspaceId,
            start: {
              kind: 'workflow-run',
              goal: result.ask,
              run: (created) => startRoutedRun({ sessionId: created.id, result }),
            },
          })
        : startRoutedRun({ sessionId, result }));
      if (claim.isCurrent()) {
        clearAsked({ asked });
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
  }, [clearAsked, prepare, sessionId, startFromDraft, text, workspaceId]);

  return { text, setText, start, isStarting, error };
};
