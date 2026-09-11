import { listMessagesForAgent, setResolveAttemptPhase, upsertResolveThread } from '@goodboy/db';
import type { ResolveAttempt, ResolveThread } from '@goodboy/types';
import { listLiveRunIds } from '../../../features/chat/turn';
import {
  worktreeWriterStatus,
  type WorktreeWriterLease,
} from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { resolverTurnOutcomes } from '../../../features/session/resolverTurnOutcomes';
import { outcomePatch } from './outcomePatch';
import { resolveWorktreePath } from './resolveWorktreePath';
import type { SessionParams, SliceParams } from './types';

type Params = SliceParams &
  SessionParams & {
    readonly rows: ReadonlyArray<ResolveThread>;
    readonly attempts: ReadonlyArray<ResolveAttempt>;
  };

export const TARGET_UNRESOLVED = 'target_unresolved';

const isActive = ({ attempt }: { readonly attempt: ResolveAttempt }): boolean =>
  attempt.phase === 'queued' || attempt.phase === 'running';

const isTargetless = ({ attempt }: { readonly attempt: ResolveAttempt }): boolean =>
  isActive({ attempt }) && attempt.mountTarget === null;

type DowngradeParams = {
  readonly attempts: ReadonlyArray<ResolveAttempt>;
  readonly rows: ReadonlyArray<ResolveThread>;
};

const downgradeTargetless = async ({ attempts, rows }: DowngradeParams): Promise<void> => {
  for (const attempt of attempts.filter((candidate) => isTargetless({ attempt: candidate }))) {
    await setResolveAttemptPhase({
      db: tauriDatabase,
      id: attempt.id,
      phase: 'failed',
      error: TARGET_UNRESOLVED,
    });
    for (const row of rows) {
      if (row.activeAttemptId !== attempt.id || row.state === 'closed') {
        continue;
      }
      await upsertResolveThread({
        db: tauriDatabase,
        row: {
          ...row,
          state: 'failed',
          stateReason: TARGET_UNRESOLVED,
          activeAttemptId: null,
          updatedAt: Date.now(),
        },
        expectedRevision: row.revision,
      });
    }
  }
};

export const reconcileResolveAttempts = async ({
  get,
  sessionId,
  rows,
  attempts,
}: Params): Promise<void> => {
  await downgradeTargetless({ attempts, rows });
  const targeted = attempts.filter((attempt) => !isTargetless({ attempt }));
  const hasPendingWork =
    rows.some((row) => row.state === 'working') ||
    targeted.some((attempt) => attempt.phase === 'running');
  if (!hasPendingWork) {
    return;
  }
  const liveRunIds = await listLiveRunIds();
  const leases = new Map<string, WorktreeWriterLease>();
  const leaseFor = async ({
    attempt,
  }: {
    readonly attempt: ResolveAttempt;
  }): Promise<WorktreeWriterLease | null> => {
    const worktreePath = await resolveWorktreePath({
      get,
      sessionId,
      target: attempt.mountTarget,
    });
    if (worktreePath === null) {
      return null;
    }
    const known = leases.get(worktreePath);
    if (known !== undefined) {
      return known;
    }
    const fresh = await worktreeWriterStatus({ path: worktreePath });
    leases.set(worktreePath, fresh);
    return fresh;
  };
  for (const attempt of targeted) {
    const lease = await leaseFor({ attempt });
    const working = rows.filter(
      (row) => row.state === 'working' && row.activeAttemptId === attempt.id,
    );
    const turnState = get().agentTurnState?.[attempt.agentId];
    const agent = get().sessionPhaseRuns[sessionId]?.find((item) => item.id === attempt.agentId);
    const runId = turnState?.kind === 'running' ? turnState.runId : agent?.runId;
    const isLeased =
      lease !== null &&
      lease.holder === attempt.agentId &&
      lease.runId !== null &&
      !lease.hasExited;
    const isRunning = isLeased || (runId !== undefined && liveRunIds.has(runId));
    if (attempt.phase === 'queued' || (attempt.phase === 'running' && isRunning)) {
      continue;
    }
    if (working.length === 0) {
      if (attempt.phase === 'running') {
        await setResolveAttemptPhase({
          db: tauriDatabase,
          id: attempt.id,
          phase: 'failed',
          error: 'interrupted',
        });
      }
      continue;
    }
    const nextAttempt = targeted.find(
      (item) => item.agentId === attempt.agentId && item.createdAt > attempt.createdAt,
    );
    const messages = await listMessagesForAgent(tauriDatabase, attempt.agentId);
    const assistantText = messages
      .filter((message) => {
        const timestamp = Date.parse(message.createdAt);
        return (
          message.role === 'assistant' &&
          timestamp >= (attempt.startedAt ?? attempt.createdAt) &&
          (attempt.endedAt === null || timestamp <= attempt.endedAt) &&
          (nextAttempt === undefined || timestamp < nextAttempt.createdAt)
        );
      })
      .map((message) => message.content)
      .join('\n');
    const parsed = resolverTurnOutcomes({ assistantText, previousOutcomes: {} });
    let hasFailure = false;
    let hasQuestion = false;
    for (const row of working) {
      const outcome = parsed.turnOutcomes[row.threadId];
      const patch =
        outcome === undefined
          ? ({
              state: 'failed',
              stateReason: 'interrupted',
              disposition: null,
              commitShas: null,
              replyDraft: null,
              question: null,
            } satisfies Partial<ResolveThread>)
          : outcomePatch({ outcome, verdict: parsed.analysisVerdicts[row.threadId] });
      hasFailure = hasFailure || patch.state === 'failed';
      hasQuestion = hasQuestion || patch.state === 'needs_answer';
      await upsertResolveThread({
        db: tauriDatabase,
        row: { ...row, ...patch, updatedAt: Date.now() },
        expectedRevision: row.revision,
      });
    }
    await setResolveAttemptPhase({
      db: tauriDatabase,
      id: attempt.id,
      phase: hasFailure ? 'failed' : hasQuestion ? 'waiting' : 'finished',
      error: hasFailure ? 'interrupted' : null,
    });
  }
};
