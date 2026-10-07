import type {
  Agent,
  ContextSlot,
  OpenQuestion,
  PullRequestState,
  SessionId,
  TurnEvent,
} from '@goodboy/types';
import type { AppStore } from '../../../store/store';
import { pullRequestKindOf } from '../../../shared/pullRequestKind';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { WORKFLOW_RUN_KIND } from '../../actions/kinds/workflowRun';
import { classifyAgent } from '../agent-kind';
import { sessionTitle } from '../sessionTitle';
import { reviewRowsOf, rowStateOf } from '../../resolve/reviewRows';
import { resolveWordOfState } from '../../resolve/commentProjection';
import { threadLocationOf } from '../../resolve/threadLocationOf';
import type { AskPackAgent, AskPackComment, AskPackInput, AskPackRun } from './buildAskPack';
import type { AskRightNowInput } from './askRightNow';

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
};

const EMPTY_AGENTS: ReadonlyArray<Agent> = [];
const EMPTY_QUESTIONS: ReadonlyArray<OpenQuestion> = [];
const EMPTY_SLOTS: ReadonlyArray<ContextSlot> = [];
const EMPTY_EVENTS: ReadonlyArray<TurnEvent> = [];
const HIDDEN_EVENT_KINDS: ReadonlySet<string> = new Set(['decisions_changed']);
const MINUTE_MS = 60_000;

const liveAgentsOf = ({ state, sessionId }: Params): ReadonlyArray<Agent> =>
  (state.sessionPhaseRuns[sessionId] ?? EMPTY_AGENTS).filter((agent) => agent.deletedAt == null);

const isResolver = ({ state, agent }: { readonly state: AppStore; readonly agent: Agent }) =>
  classifyAgent({ agent, override: state.agentKindOverride[agent.id] ?? null }) === 'resolver';

const runningSince = ({ state, agent }: { readonly state: AppStore; readonly agent: Agent }) => {
  const turn = state.agentTurnState[agent.id];
  if (turn?.kind === 'running') {
    return turn.startedAt;
  }
  return agent.status === 'running' ? (agent.startedAt ?? null) : null;
};

const sessionPullRequestOf = ({ state, sessionId }: Params): PullRequestState | null => {
  const all = Object.values(state.sessionProjectPrs[sessionId] ?? {}).flat();
  const selected = state.sessionSelectedPrNumber[sessionId] ?? null;
  return (
    all.find((pr) => pr.number === selected) ??
    all.find((pr) => pr.state === 'open') ??
    all[0] ??
    null
  );
};

const commentRowsOf = ({ state, sessionId }: Params) =>
  reviewRowsOf({ state, sessionId }).map((row) => ({
    row,
    word: resolveWordOfState({ state: rowStateOf({ state, sessionId, row }) }),
  }));

const questionAuthorOf = ({
  state,
  sessionId,
  question,
}: Params & { readonly question: OpenQuestion }): string | null => {
  if (question.createdByAgentId === undefined) {
    return null;
  }
  return (
    liveAgentsOf({ state, sessionId }).find((agent) => agent.id === question.createdByAgentId)
      ?.name ?? null
  );
};

type DigestParams = Params & {
  readonly now: number;
};

export const askDigestOf = ({
  state,
  sessionId,
  now,
}: DigestParams): Omit<AskRightNowInput, 'description' | 'cost'> => {
  const agents = liveAgentsOf({ state, sessionId }).filter(
    (agent) => !isResolver({ state, agent }),
  );
  const runningAgents = agents.flatMap((agent) => {
    const since = runningSince({ state, agent });
    if (since === null && agent.status !== 'running') {
      return [];
    }
    const minutes =
      since === null ? null : Math.max(0, Math.round((now - Date.parse(since)) / MINUTE_MS));
    return [{ name: agent.name, minutes }];
  });
  const questions = (state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS).filter(
    (question) => question.status === 'open',
  );
  return {
    commentWords: commentRowsOf({ state, sessionId }).map((entry) => entry.word),
    prNumber: sessionPullRequestOf({ state, sessionId })?.number ?? null,
    runningAgents,
    failedAgents: agents.filter((agent) => agent.status === 'failed').map((agent) => agent.name),
    openQuestionsFrom: questions.map((question) =>
      questionAuthorOf({ state, sessionId, question }),
    ),
  };
};

const slotValue = ({
  slots,
  key,
}: {
  readonly slots: ReadonlyArray<ContextSlot>;
  readonly key: string;
}) => slots.find((slot) => slot.key === key)?.value ?? '';

const transcriptTailOf = ({ events }: { readonly events: ReadonlyArray<TurnEvent> }): string =>
  events
    .flatMap((event) => (event.kind === 'assistant_text' ? [event.delta] : []))
    .join('')
    .slice(-12_000);

const clockOf = (iso: string): string => {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const agentsOf = ({ state, sessionId }: Params): ReadonlyArray<AskPackAgent> => {
  const questions = state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS;
  return liveAgentsOf({ state, sessionId }).map((agent) => {
    const since = runningSince({ state, agent }) ?? agent.startedAt ?? null;
    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      isNeedsYou: questions.some(
        (question) => question.status === 'open' && question.createdByAgentId === agent.id,
      ),
      summary: agent.outputSummary ?? '',
      since: since === null ? null : clockOf(since),
      transcriptTail: transcriptTailOf({ events: state.transcripts[agent.id] ?? EMPTY_EVENTS }),
    };
  });
};

const runsOf = ({ state, sessionId }: Params): ReadonlyArray<AskPackRun> => {
  const session = sessionById(state.sessions, sessionId);
  return (session?.workflowRuns ?? [])
    .filter((run) => run.discardedAt == null)
    .flatMap((run) => {
      const facts = WORKFLOW_RUN_KIND.facts({
        state,
        target: { kind: 'workflowRun', sessionId, runId: run.id },
      });
      if (facts === null) {
        return [];
      }
      return [
        {
          id: run.id,
          title: facts.name,
          isRunning: facts.state !== 'done',
          detail: [facts.state, run.orchestratorSummary ?? '']
            .filter((part) => part !== '')
            .join(' · '),
        },
      ];
    });
};

const commentsOf = ({ state, sessionId }: Params): ReadonlyArray<AskPackComment> =>
  commentRowsOf({ state, sessionId }).map(({ row, word }) => ({
    threadId: row.thread.threadId,
    word,
    author: row.commentThread?.head.author ?? null,
    location: threadLocationOf({ row })?.shortLabel ?? null,
    body: row.commentThread?.head.body ?? row.thread.question ?? '',
  }));

type CollectParams = Params & {
  readonly rightNow: ReadonlyArray<string>;
};

export const collectAskPackInput = ({
  state,
  sessionId,
  rightNow,
}: CollectParams): AskPackInput => {
  const session = sessionById(state.sessions, sessionId);
  const slots = state.sessionSlots[sessionId] ?? EMPTY_SLOTS;
  const pr = sessionPullRequestOf({ state, sessionId });
  const questions = (state.sessionOpenQuestions[sessionId] ?? EMPTY_QUESTIONS).filter(
    (question) => question.status === 'open' || question.status === 'answered',
  );
  return {
    title: sessionTitle({ session: session ?? null }),
    rightNow,
    goal: slotValue({ slots, key: 'goal' }),
    decisions: slotValue({ slots, key: 'decisions' }),
    summary: slotValue({ slots, key: 'last_output_summary' }),
    agents: agentsOf({ state, sessionId }),
    questions: questions.map((question) => ({
      id: question.id,
      text: question.text,
      from: questionAuthorOf({ state, sessionId, question }),
      isOpen: question.status === 'open',
      answer: question.userAnswer,
      suggestions: question.suggestedAnswers,
    })),
    runs: runsOf({ state, sessionId }),
    comments: commentsOf({ state, sessionId }),
    branches: (state.sessionProjectMounts[sessionId] ?? []).map((mount) => ({
      mountName: mount.mountName,
      branch: mount.branch,
      baseBranch: mount.baseBranch,
    })),
    pullRequest:
      pr === null
        ? null
        : {
            number: pr.number,
            title: pr.title,
            state: pullRequestKindOf({ state: pr.state, isDraft: pr.isDraft }),
          },
    artifacts: (state.sessionArtifacts[sessionId] ?? []).map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      kind: artifact.kind,
      isPlan: artifact.kind === 'plan',
    })),
    events: (state.sessionEvents[sessionId] ?? [])
      .filter((event) => !HIDDEN_EVENT_KINDS.has(event.kind))
      .map((event) => {
        const title =
          event.payload?.title ?? event.payload?.workflowName ?? event.payload?.branch ?? '';
        return `${clockOf(event.createdAt)} ${event.kind.replace(/_/g, ' ')}${title === '' ? '' : `: ${title}`}`;
      }),
  };
};
