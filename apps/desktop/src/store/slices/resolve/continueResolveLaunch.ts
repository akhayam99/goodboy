import type { AgentId, ResolveAttempt, SessionId } from '@goodboy/types';
import {
  buildResolverKickoffParts,
  type PriorContext,
  type ResolverStyle,
} from '../../../features/chat/spawn-from-comment';
import { joinKickoffParts } from '../../../features/chat/utils/resolverKickoffParts';
import { invokeAgentUpdateStatus } from '../../../features/workflows/workflows';
import type { ResolveQueueRow } from '../../../features/resolve/buildResolveQueueRows';
import { resolveFixupTargets } from '../../../features/resolve/resolveFixupTargets';
import { launchRowsOf } from '../../../features/resolve/reviewRows';
import { sessionResolveStyle } from '../../sessionReplySettings';
import type { GetFn } from './types';

export type ContinueEntry = {
  readonly threadId: string;
  readonly intent: 'retry' | 'answer';
  readonly question?: string | null;
  readonly answer?: string | null;
};

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly entries: ReadonlyArray<ContinueEntry>;
  readonly hint?: string;
};

const NO_RUN = 'This fix run is no longer available. Start the fix again';
const NO_COMMENT = 'This comment is no longer on the pull request';

type Group = {
  readonly attempt: ResolveAttempt;
  readonly entries: Array<{ readonly entry: ContinueEntry; readonly row: ResolveQueueRow }>;
};

const groupsOf = ({
  entries,
  rows,
  attempts,
}: {
  readonly entries: ReadonlyArray<ContinueEntry>;
  readonly rows: ReadonlyArray<ResolveQueueRow>;
  readonly attempts: ReadonlyArray<ResolveAttempt>;
}): ReadonlyArray<Group> => {
  const groups = new Map<AgentId, Group>();
  for (const entry of entries) {
    const row = rows.find((candidate) => candidate.thread.threadId === entry.threadId);
    if (row === undefined) {
      throw new Error(NO_COMMENT);
    }
    const active = attempts.find((attempt) => attempt.id === row.thread.activeAttemptId);
    const attempt =
      active ?? [...attempts].reverse().find((item) => item.threadIds.includes(entry.threadId));
    if (attempt === undefined) {
      throw new Error(NO_RUN);
    }
    const group = groups.get(attempt.agentId);
    if (group === undefined) {
      groups.set(attempt.agentId, { attempt, entries: [{ entry, row }] });
      continue;
    }
    group.entries.push({ entry, row });
  }
  return [...groups.values()];
};

export const continueResolveLaunch = async ({
  get,
  sessionId,
  entries,
  hint = '',
}: Params): Promise<void> => {
  const state = get();
  const attempts = state.sessionResolveAttempts[sessionId] ?? [];
  const rows = launchRowsOf({ state, sessionId });
  const pr = state.sessionGithub[sessionId]?.pr ?? null;
  const base = sessionResolveStyle({ state, sessionId });
  for (const group of groupsOf({ entries, rows, attempts })) {
    const threads = group.entries.flatMap(({ row }) =>
      row.commentThread === null ? [] : [row.commentThread],
    );
    if (threads.length === 0) {
      throw new Error(NO_COMMENT);
    }
    const commitStyle = group.attempt.launchChoice?.commitStyle ?? base.commitStyle;
    const fixupTargets =
      commitStyle === 'fixup' && base.worktreePath !== null
        ? await resolveFixupTargets({ worktreePath: base.worktreePath, threads })
        : [];
    const style: ResolverStyle = {
      commitStyle,
      fixupTargets,
      voice: base.voice,
      styleNote: base.styleNote,
    };
    const priorContext: ReadonlyArray<PriorContext> = group.entries.map(({ entry, row }) => ({
      threadId: entry.threadId,
      reply: row.thread.replyDraft,
      ...(row.thread.commitShas != null && { commitShas: row.thread.commitShas }),
      ...(entry.question != null && { question: entry.question }),
      ...(entry.answer != null && { answer: entry.answer }),
      intent: entry.intent,
    }));
    const content = joinKickoffParts(
      buildResolverKickoffParts({ threads, pr, hint, priorContext, style }),
    );
    const agent = (state.sessionPhaseRuns[sessionId] ?? []).find(
      (item) => item.id === group.attempt.agentId,
    );
    if (agent === undefined) {
      throw new Error(NO_RUN);
    }
    if (agent.status === 'skipped') {
      await invokeAgentUpdateStatus(agent.id, { status: 'pending' });
    }
    void get()
      .sendTurn({
        sessionId,
        agentId: agent.id,
        content,
        resolveThreadIds: group.entries.map(({ entry }) => entry.threadId),
      })
      .catch((error: unknown) =>
        get().reportError({ title: "Couldn't continue the fix run", error, sessionId }),
      );
  }
};
