import type {
  Agent,
  MountId,
  OpenQuestion,
  ResolveAttempt,
  ResolveThread,
  Session,
  SessionAttentionReason,
  SessionId,
} from '@goodboy/types';
import { agentPlace, branchPlace, questionPlace, sessionPlace } from '../../store';
import { partitionDelegatedQuestions } from '../context/questionDelegate';
import { stagedQuestionIds } from '../context/stagedQuestionIds';
import { selectOpenQuestions } from './components/SessionOverviewPane/lib';
import type { NotificationPlaceReason } from './notificationPlaceReason';
import { branchLandingTabOf } from '../branch/branchLandingTab';
import { isTurnStatePermissionBlocked } from './agent-lifecycle';
import type { PlaceRequest } from '../../store/slices/navigation/types';
import { agentHasUnread } from '../../store/slices/agents/agentHasUnread';
import { sessionById } from '../../store/slices/sessions/sessionIndex';
import { resolveAttentionOf } from '../../store/slices/resolve/resolveAttention';
import { autoFailedRootsOf } from '../../store/slices/session-view/autoFailedRootsOf';
import { autoLimitRootsOf } from '../../store/slices/session-view/autoLimitRootsOf';
import {
  autoWaitRootsOf,
  type AutoWaitState,
} from '../../store/slices/session-view/autoWaitRootsOf';
import {
  runWaitEntriesOf,
  type RunWaitEntry,
  type RunWaitState,
} from '../../store/slices/session-view/runWaitEntriesOf';
import { runAwaitsPlanReview } from '../plans/runAwaitsPlanReview';

type State = AutoWaitState &
  RunWaitState & {
    readonly sessions: ReadonlyArray<Session>;
    readonly sessionPhaseRuns: Readonly<Record<string, ReadonlyArray<Agent>>>;
    readonly sessionOpenQuestions?: Readonly<Record<string, ReadonlyArray<OpenQuestion>>>;
    readonly sessionResolveThreads?: Readonly<Record<string, ReadonlyArray<ResolveThread>>>;
    readonly sessionResolveAttempts?: Readonly<Record<string, ReadonlyArray<ResolveAttempt>>>;
    readonly sessionProjectMounts?: Readonly<
      Record<
        string,
        ReadonlyArray<{
          readonly mountId: MountId;
          readonly worktreePath: string | null;
          readonly lastWorktreePath: string | null;
        }>
      >
    >;
  };

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly reason: SessionAttentionReason | NotificationPlaceReason | null;
  readonly mountId?: MountId | null;
  readonly subject?: 'note' | 'comment';
};

type MountPathParams = {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
};

const mountPathOf = ({ state, sessionId, mountId }: MountPathParams): string | null => {
  if (mountId === null) {
    return null;
  }
  const mount = state.sessionProjectMounts?.[sessionId]?.find(
    (candidate) => candidate.mountId === mountId,
  );
  return mount === undefined ? null : (mount.worktreePath ?? mount.lastWorktreePath);
};

const latestAgent = ({ agents }: { readonly agents: ReadonlyArray<Agent> }): Agent | null =>
  agents.reduce<Agent | null>(
    (latest, agent) => (latest === null || agent.ordinal > latest.ordinal ? agent : latest),
    null,
  );

const RUN_WAIT_BY_REASON: Partial<Record<NotificationPlaceReason, RunWaitEntry['wait']>> = {
  'run-stopped': 'stopped',
  'run-paused-at-limit': 'limit',
  'run-waits-for-go': 'go',
};

export const attentionPlace = ({
  state,
  sessionId,
  reason,
  mountId = null,
  subject,
}: Params): PlaceRequest => {
  const mountPath = mountPathOf({ state, sessionId, mountId });
  const runWait = reason === null ? undefined : RUN_WAIT_BY_REASON[reason];
  if (runWait !== undefined) {
    const session = sessionById(state.sessions, sessionId);
    const entry =
      session === undefined
        ? undefined
        : runWaitEntriesOf({
            state,
            session,
            agents: state.sessionPhaseRuns[sessionId] ?? [],
          }).find((candidate) => candidate.wait === runWait);
    if (entry === undefined) {
      const [limitRoot] =
        reason === 'run-paused-at-limit' && session !== undefined
          ? autoLimitRootsOf({ state, session, agents: state.sessionPhaseRuns[sessionId] ?? [] })
          : [];
      if (limitRoot !== undefined) {
        return agentPlace({ sessionId, agentId: limitRoot.id });
      }
      return sessionPlace({ sessionId, lens: 'workflows' });
    }
    return sessionPlace({
      sessionId,
      lens: 'workflows',
      target: { kind: 'run', runId: entry.runId },
    });
  }
  if (reason === 'auto-needs-you') {
    const session = sessionById(state.sessions, sessionId);
    const [root] =
      session === undefined
        ? []
        : autoWaitRootsOf({ state, session, agents: state.sessionPhaseRuns[sessionId] ?? [] });
    return root === undefined
      ? sessionPlace({ sessionId })
      : agentPlace({ sessionId, agentId: root.id });
  }
  if (reason === 'open-question') {
    const staged = stagedQuestionIds();
    const waiting = partitionDelegatedQuestions({
      questions: selectOpenQuestions(state.sessionOpenQuestions?.[sessionId] ?? []),
      agents: state.sessionPhaseRuns[sessionId] ?? [],
    }).answerable.find((question) => !staged.includes(question.id));
    return waiting === undefined
      ? sessionPlace({ sessionId, lens: 'questions' })
      : questionPlace({ sessionId, questionId: waiting.id });
  }
  if (reason === 'plan-approval') {
    const heldRun = state.sessions
      .find((session) => session.id === sessionId)
      ?.workflowRuns.find(
        (run) => run.discardedAt == null && runAwaitsPlanReview({ state, sessionId, run }),
      );
    if (heldRun === undefined) {
      return sessionPlace({ sessionId, lens: 'workflows' });
    }
    return sessionPlace({
      sessionId,
      lens: 'workflows',
      target: { kind: 'run', runId: heldRun.id },
    });
  }
  if (reason === 'push-failed') {
    return branchPlace({ sessionId, mountPath, tab: 'comments' });
  }
  if (reason === 'ci-failed') {
    return branchPlace({ sessionId, mountPath, tab: 'checks' });
  }
  if (reason === 'history-stopped') {
    return branchPlace({ sessionId, mountPath, tab: 'commits' });
  }
  if (reason === 'fix-needs-you' || reason === 'fix-couldnt-fix') {
    const attention = resolveAttentionOf({
      threads: state.sessionResolveThreads?.[sessionId] ?? [],
      attempts: state.sessionResolveAttempts?.[sessionId] ?? [],
    });
    const comments = reason === 'fix-needs-you' ? attention.needsYou : attention.couldntFix;
    const notes = reason === 'fix-needs-you' ? attention.notesNeedYou : attention.notesCouldntFix;
    const isNoteFirst = subject === undefined ? comments === 0 && notes > 0 : subject === 'note';
    return branchPlace({
      sessionId,
      mountPath,
      tab: isNoteFirst ? 'files' : 'comments',
    });
  }
  if (reason === 'pr-approved' || reason === 'changes-requested' || reason === 'pr-opened') {
    return branchPlace({
      sessionId,
      mountPath,
      tab: branchLandingTabOf({ deepLink: 'pr' }),
    });
  }
  if (reason === null) {
    return sessionPlace({ sessionId });
  }

  const agents = state.sessionPhaseRuns[sessionId] ?? [];
  const errorSession =
    reason === 'agent-error' ? sessionById(state.sessions, sessionId) : undefined;
  const [failedAutoRoot] =
    errorSession === undefined ? [] : autoFailedRootsOf({ state, session: errorSession, agents });
  const target =
    reason === 'needs-approval'
      ? latestAgent({
          agents: agents.filter((agent) =>
            isTurnStatePermissionBlocked({ turnState: state.agentTurnState[agent.id] }),
          ),
        })
      : reason === 'agent-error'
        ? (failedAutoRoot ??
          latestAgent({ agents: agents.filter((agent) => agent.status === 'failed') }))
        : reason === 'unread-reply'
          ? latestAgent({ agents: agents.filter((agent) => agentHasUnread(agent, false)) })
          : reason === 'slack-reply-waiting'
            ? latestAgent({ agents })
            : null;

  if (target === null) {
    return sessionPlace({ sessionId });
  }
  return agentPlace({ sessionId, agentId: target.id });
};
