import { listOpenQuestionsForSession } from '@goodboy/db';
import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { workflowRunHasOpenQuestions } from '../../../features/context/openQuestionsGate';
import { tauriDatabase } from '../../../shared/lib/db';
import { findIdleRuns, type IdleRun } from './findIdleRuns';
import { isSessionAdvancing } from './maybeAutoAdvanceWorkflow';
import { persistOrchestrationStop } from './orchestrateNextStep';
import type { RunIdleEpisode } from './state';
import type { GetFn, SetFn } from './types';

export const RUN_WATCHDOG_TICK_MS = 15_000;
const RUN_IDLE_BEFORE_NUDGE_MS = 45_000;
const RUN_NUDGE_INTERVAL_MS = 90_000;
const RUN_MAX_NUDGES = 3;

const STALLED_TITLE = 'Run stopped moving';
const STALLED_MESSAGE =
  'Nothing picked this run up after three tries. Retry to ask the orchestrator for the next step.';

type Episodes = Readonly<Record<WorkflowRunId, RunIdleEpisode>>;

type SweepParams = {
  readonly nowMs?: number;
};

type TrackParams = {
  readonly episodes: Episodes;
  readonly idle: ReadonlyArray<IdleRun>;
  readonly nowMs: number;
};

const trackEpisodes = ({ episodes, idle, nowMs }: TrackParams): Episodes =>
  Object.fromEntries(
    idle.map(({ run }) => [
      run.id,
      episodes[run.id] ?? { since: nowMs, nudges: 0, lastNudgeAt: null },
    ]),
  );

type SameParams = {
  readonly before: Episodes;
  readonly after: Episodes;
};

const isSameEpisodes = ({ before, after }: SameParams): boolean => {
  const kept = Object.keys(after);
  return (
    kept.length === Object.keys(before).length &&
    kept.every((id) => before[id as WorkflowRunId] === after[id as WorkflowRunId])
  );
};

type SaveParams = {
  readonly set: SetFn;
  readonly workflowRunId: WorkflowRunId;
  readonly episode: RunIdleEpisode;
};

const saveEpisode = ({ set, workflowRunId, episode }: SaveParams): void => {
  set((state) => ({
    runIdleEpisodes: { ...state.runIdleEpisodes, [workflowRunId]: episode },
  }));
};

type WaitingParams = {
  readonly idle: IdleRun;
};

const isWaitingOnOwner = async ({ idle }: WaitingParams): Promise<boolean> => {
  const questions = await listOpenQuestionsForSession(tauriDatabase, idle.sessionId, 'open');
  return workflowRunHasOpenQuestions({ questions, run: idle.run });
};

type GiveUpParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly idle: IdleRun;
};

const giveUp = async ({ set, get, idle }: GiveUpParams): Promise<void> => {
  await persistOrchestrationStop({
    set,
    sessionId: idle.sessionId,
    workflowRunId: idle.run.id,
    stop: { kind: 'failure', message: STALLED_MESSAGE },
  });
  void get().emitNotification({
    kind: 'error',
    severity: 'warning',
    title: STALLED_TITLE,
    body: STALLED_MESSAGE,
    sessionId: idle.sessionId,
    coalesceKey: `run-stalled:${idle.run.id}`,
  });
};

export const sweepIdleRuns = (set: SetFn, get: GetFn) => {
  let isSweeping = false;
  return async ({ nowMs = Date.now() }: SweepParams = {}): Promise<void> => {
    if (isSweeping) {
      return;
    }
    isSweeping = true;
    try {
      const state = get();
      const idle = findIdleRuns({
        sessions: state.sessions,
        sessionPhaseRuns: state.sessionPhaseRuns,
        phaseTemplates: state.phaseTemplates,
        sessionOpenQuestions: state.sessionOpenQuestions,
        orchestratingWorkflowRuns: state.orchestratingWorkflowRuns,
        pendingOrchestrations: state.pendingOrchestrations,
        isSessionAdvancing,
      });
      const tracked = trackEpisodes({ episodes: state.runIdleEpisodes, idle, nowMs });
      if (!isSameEpisodes({ before: state.runIdleEpisodes, after: tracked })) {
        set({ runIdleEpisodes: tracked });
      }
      const nudged = new Set<SessionId>();
      for (const candidate of idle) {
        const episode = tracked[candidate.run.id]!;
        if (nowMs - episode.since < RUN_IDLE_BEFORE_NUDGE_MS) {
          continue;
        }
        if (episode.lastNudgeAt !== null && nowMs - episode.lastNudgeAt < RUN_NUDGE_INTERVAL_MS) {
          continue;
        }
        if (await isWaitingOnOwner({ idle: candidate })) {
          continue;
        }
        if (episode.nudges >= RUN_MAX_NUDGES) {
          await giveUp({ set, get, idle: candidate });
          continue;
        }
        saveEpisode({
          set,
          workflowRunId: candidate.run.id,
          episode: { ...episode, nudges: episode.nudges + 1, lastNudgeAt: nowMs },
        });
        if (nudged.has(candidate.sessionId)) {
          continue;
        }
        nudged.add(candidate.sessionId);
        void get().maybeAutoAdvanceWorkflow(candidate.sessionId);
      }
    } finally {
      isSweeping = false;
    }
  };
};
