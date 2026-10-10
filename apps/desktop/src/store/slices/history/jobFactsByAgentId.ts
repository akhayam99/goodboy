import type { MountId, SessionEvent, SessionId } from '@goodboy/types';
import { historyStopCause } from '../../../features/history/historyStopCause';
import { rebaseJobOf, type RebaseJobTone } from '../../../features/history/rebaseJob';
import type { ScribeWork } from '../scribe/types';
import type { HistoryRun } from './types';

export type JobActivityPhase = 'running' | 'waiting' | 'failed' | 'done';

export type JobActivityFacts = {
  readonly kind: 'rebase' | 'pull-request-text';
  readonly title: string;
  readonly word: string;
  readonly phase: JobActivityPhase;
  readonly isAutomatic: boolean;
  readonly mountId: string | null;
};

export type JobMountContext = {
  readonly projectName: string;
  readonly baseBranch: string;
};

type ContextOfParams = {
  readonly mountId: string;
};

type Params = {
  readonly sessionId: SessionId;
  readonly historyRuns: Readonly<Record<MountId, HistoryRun>>;
  readonly scribeWork: Readonly<Record<string, ScribeWork>>;
  readonly events: ReadonlyArray<SessionEvent>;
  readonly contextOf: (params: ContextOfParams) => JobMountContext;
};

const PHASE_OF_TONE: Readonly<Record<RebaseJobTone, JobActivityPhase>> = {
  info: 'running',
  ok: 'done',
  warn: 'waiting',
  danger: 'failed',
};

type RebaseTitleOfParams = {
  readonly baseBranch: string;
};

const rebaseTitleOf = ({ baseBranch }: RebaseTitleOfParams): string => `Rebase on ${baseBranch}`;

const rebaseFactsOfRuns = ({
  sessionId,
  historyRuns,
  contextOf,
}: Pick<Params, 'sessionId' | 'historyRuns' | 'contextOf'>): ReadonlyMap<
  string,
  JobActivityFacts
> => {
  const facts = new Map<string, JobActivityFacts>();
  for (const run of Object.values(historyRuns)) {
    if (run.sessionId !== sessionId || run.agentId === null) {
      continue;
    }
    const context = contextOf({ mountId: run.mountId });
    const job = rebaseJobOf({
      run,
      projectName: context.projectName,
      baseBranch: context.baseBranch,
      commitCount: run.commitCount,
      dirtyCount: null,
    });
    if (job === null) {
      continue;
    }
    facts.set(run.agentId, {
      kind: 'rebase',
      title: rebaseTitleOf({ baseBranch: context.baseBranch }),
      word: job.word,
      phase: PHASE_OF_TONE[job.tone],
      isAutomatic: false,
      mountId: run.mountId,
    });
  }
  return facts;
};

type IsFailureReasonParams = {
  readonly reason: string | undefined;
};

const isFailureReason = ({ reason }: IsFailureReasonParams): boolean =>
  reason === 'failed' || reason === 'push-failed';

type RebaseFactOfEventParams = {
  readonly event: SessionEvent;
  readonly contextOf: Params['contextOf'];
};

const rebaseFactOfEvent = ({
  event,
  contextOf,
}: RebaseFactOfEventParams): JobActivityFacts | null => {
  const payload = event.payload;
  if (payload?.agentId === undefined || payload.origin !== 'rebase') {
    return null;
  }
  const mountId = payload.mountId ?? null;
  const base = {
    kind: 'rebase' as const,
    title: rebaseTitleOf({
      baseBranch: mountId === null ? 'main' : contextOf({ mountId }).baseBranch,
    }),
    isAutomatic: false,
    mountId,
  };
  if (event.kind === 'history_rewritten' || event.kind === 'history_pushed') {
    return { ...base, word: 'Done', phase: 'done' };
  }
  if (event.kind !== 'history_stopped') {
    return null;
  }
  const cause = historyStopCause({ reason: payload.reason, message: payload.title });
  return {
    ...base,
    word: cause === null ? 'Stopped' : `Stopped: ${cause}`,
    phase: isFailureReason({ reason: payload.reason }) ? 'failed' : 'waiting',
  };
};

const rebaseFactsOfEvents = ({
  events,
  contextOf,
}: Pick<Params, 'events' | 'contextOf'>): ReadonlyMap<string, JobActivityFacts> => {
  const latest = new Map<string, SessionEvent>();
  for (const event of events) {
    const agentId = event.payload?.agentId;
    if (agentId === undefined || !event.kind.startsWith('history_')) {
      continue;
    }
    const known = latest.get(agentId);
    if (known === undefined || event.createdAt >= known.createdAt) {
      latest.set(agentId, event);
    }
  }
  const facts = new Map<string, JobActivityFacts>();
  for (const [agentId, event] of latest) {
    const fact = rebaseFactOfEvent({ event, contextOf });
    if (fact !== null) {
      facts.set(agentId, fact);
    }
  }
  return facts;
};

const SCRIBE_TITLES = {
  pr: 'Pull request text',
  'pr-update': 'Refresh pull request text',
  'commit-message': 'Commit message',
} as const satisfies Record<ScribeWork['task']['kind'], string>;

type ScribeWordOfParams = {
  readonly work: ScribeWork;
};

const scribeWordOf = ({ work }: ScribeWordOfParams): string => {
  const hasText = work.output !== null;
  switch (work.status) {
    case 'writing':
      return 'Writing';
    case 'ready':
      return work.task.kind === 'pr' ? 'Text ready' : 'Done';
    case 'creating':
      return 'Opening';
    case 'created':
      if (work.task.kind !== 'pr') {
        return 'Done';
      }
      return work.pullRequest === null ? 'Created' : `Created #${work.pullRequest.number}`;
    case 'failed':
      return work.task.kind === 'pr' && hasText && work.pullRequest === null
        ? "Couldn't open"
        : "Couldn't write";
    default: {
      const exhaustive: never = work.status;
      return exhaustive;
    }
  }
};

type ScribePhaseOfParams = {
  readonly work: ScribeWork;
};

const scribePhaseOf = ({ work }: ScribePhaseOfParams): JobActivityPhase => {
  if (work.status === 'writing' || work.status === 'creating') {
    return 'running';
  }
  return work.status === 'failed' ? 'failed' : 'done';
};

const scribeFactsOf = ({
  sessionId,
  scribeWork,
}: Pick<Params, 'sessionId' | 'scribeWork'>): ReadonlyMap<string, JobActivityFacts> => {
  const facts = new Map<string, JobActivityFacts>();
  for (const work of Object.values(scribeWork)) {
    if (work.sessionId !== sessionId || work.agentId === null) {
      continue;
    }
    facts.set(work.agentId, {
      kind: 'pull-request-text',
      title: SCRIBE_TITLES[work.task.kind],
      word: scribeWordOf({ work }),
      phase: scribePhaseOf({ work }),
      isAutomatic: work.task.kind !== 'pr',
      mountId: work.mountId,
    });
  }
  return facts;
};

export const jobFactsByAgentId = ({
  sessionId,
  historyRuns,
  scribeWork,
  events,
  contextOf,
}: Params): ReadonlyMap<string, JobActivityFacts> =>
  new Map([
    ...rebaseFactsOfEvents({ events, contextOf }),
    ...rebaseFactsOfRuns({ sessionId, historyRuns, contextOf }),
    ...scribeFactsOf({ sessionId, scribeWork }),
  ]);
