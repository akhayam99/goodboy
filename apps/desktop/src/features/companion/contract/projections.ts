import type { ActionId, Int, IsoTimestamp } from './primitives';
import type { Decision } from './decisions';
import type {
  AttentionReason,
  MergeMethod,
  SessionAccess,
  SessionStage,
  StartKind,
  StartStops,
  StatusMark,
  TaskProvider,
  Tone,
} from './vocabulary';

export type ProjectionMeta = {
  readonly epoch: Int;
  readonly seq: Int;
  readonly generatedAt: IsoTimestamp;
};

export type NeedsYouRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly sessionRef: string | null;
  readonly goal: string;
  readonly reason: AttentionReason;
  readonly tone: Tone;
  readonly mark: StatusMark;
  readonly words: string;
  readonly waitingText: string | null;
  readonly since: IsoTimestamp | null;
  readonly decision: Decision | null;
};

export type NeedsYouWorkspace = {
  readonly workspaceId: string;
  readonly name: string;
  readonly moveCount: Int;
  readonly sessionCount: Int;
};

export type LimitChip = {
  readonly providerLabel: string;
  readonly leftText: string;
  readonly tone: Tone;
};

export type NeedsYouChips = {
  readonly spendToday: string | null;
  readonly limits: ReadonlyArray<LimitChip>;
};

export type NeedsYouFields = {
  readonly chips: NeedsYouChips;
  readonly moveCount: Int;
  readonly sessionCount: Int;
  readonly workspaces: ReadonlyArray<NeedsYouWorkspace>;
  readonly rows: ReadonlyArray<NeedsYouRow>;
};

export type NeedsYouProjection = ProjectionMeta & NeedsYouFields;

export type SessionRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly ref: string | null;
  readonly goal: string;
  readonly stage: SessionStage;
  readonly mark: StatusMark;
  readonly words: string | null;
  readonly tone: Tone | null;
  readonly reason: AttentionReason | null;
  readonly waitingText: string | null;
  readonly branch: string | null;
  readonly projectNames: ReadonlyArray<string>;
  readonly prNumber: Int | null;
  readonly costText: string | null;
  readonly updatedAt: IsoTimestamp;
};

export type SessionLane = {
  readonly stage: SessionStage;
  readonly title: string;
  readonly count: Int;
  readonly rows: ReadonlyArray<SessionRow>;
};

export type SessionsFields = {
  readonly workspaceId: string;
  readonly lanes: ReadonlyArray<SessionLane>;
  readonly train: TrainOffer | null;
};

export type SessionsProjection = ProjectionMeta & SessionsFields;

export type SessionFact = {
  readonly label: string;
  readonly value: string;
};

export type SessionNotice = {
  readonly id: string;
  readonly tone: Tone;
  readonly text: string;
  readonly isMacOnly: boolean;
};

export type LineTargetKind = 'agent' | 'run' | 'pullRequest' | 'decision';

export type LineTarget = {
  readonly kind: LineTargetKind;
  readonly id: string;
};

export type SessionLine = {
  readonly id: string;
  readonly mark: StatusMark;
  readonly text: string;
  readonly at: IsoTimestamp | null;
  readonly role: string | null;
  readonly target: LineTarget | null;
};

export type SessionProject = {
  readonly name: string;
  readonly branch: string | null;
  readonly prNumber: Int | null;
};

export type SessionFields = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly ref: string | null;
  readonly goal: string;
  readonly stage: SessionStage;
  readonly mark: StatusMark;
  readonly facts: ReadonlyArray<SessionFact>;
  readonly notices: ReadonlyArray<SessionNotice>;
  readonly needsYou: ReadonlyArray<NeedsYouRow>;
  readonly now: ReadonlyArray<SessionLine>;
  readonly next: ReadonlyArray<SessionLine>;
  readonly projects: ReadonlyArray<SessionProject>;
  readonly activity: ReadonlyArray<SessionLine>;
  readonly pullRequestNumber: Int | null;
  readonly decisions: ReadonlyArray<string>;
  readonly summary: string | null;
};

export type SessionProjection = ProjectionMeta & SessionFields;

export type RunState = 'running' | 'paused' | 'waiting' | 'stopped' | 'done' | 'failed';

export type AgentState = 'running' | 'waiting' | 'stopped' | 'done' | 'failed';

export type RunLimit = {
  readonly amount: number;
  readonly text: string;
};

export type AgentRow = {
  readonly agentId: string;
  readonly name: string;
  readonly role: string;
  readonly isLead: boolean;
  readonly model: string | null;
  readonly spendText: string | null;
  readonly timeText: string | null;
  readonly stopActionId: ActionId | null;
  readonly stopTreeActionId: ActionId | null;
  readonly continueActionId: ActionId | null;
  readonly sendActionId: ActionId;
  readonly mark: StatusMark;
  readonly state: AgentState;
  readonly words: string;
  readonly canStop: boolean;
  readonly canContinue: boolean;
};

export type RunRow = {
  readonly runId: string;
  readonly title: string;
  readonly mark: StatusMark;
  readonly state: RunState;
  readonly words: string;
  readonly spendText: string | null;
  readonly stopActionId: ActionId | null;
  readonly continueActionId: ActionId | null;
  readonly limit: RunLimit | null;
  readonly canStop: boolean;
  readonly canContinue: boolean;
  readonly agents: ReadonlyArray<AgentRow>;
};

export type RunsFields = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly runs: ReadonlyArray<RunRow>;
};

export type RunsProjection = ProjectionMeta & RunsFields;

export type PullRequestPhase = 'draft' | 'open' | 'approved' | 'queued' | 'merged' | 'closed';

export type CheckState = 'passing' | 'failing' | 'running' | 'skipped';

export type CheckRow = {
  readonly name: string;
  readonly state: CheckState;
  readonly mark: StatusMark;
};

export type ReviewRow = {
  readonly author: string;
  readonly words: string;
  readonly mark: StatusMark;
};

export type MergeReadiness = {
  readonly isMergeable: boolean;
  readonly reason: string | null;
  readonly caveats: ReadonlyArray<string>;
};

export type TrainEntry = {
  readonly sessionId: string;
  readonly prNumber: Int;
  readonly headSha: string;
  readonly title: string;
  readonly repo: string;
  readonly reason: string | null;
};

export type TrainPhase = 'running' | 'done' | 'halted' | 'stopped';

export type TrainStep = 'merging' | 'updating' | 'waiting';

export type TrainCarState = 'queued' | 'merging' | 'updating' | 'waiting' | 'merged' | 'stopped';

export type TrainCar = {
  readonly sessionId: string;
  readonly prNumber: Int;
  readonly state: TrainCarState;
  readonly mark: StatusMark;
  readonly line: string;
};

export type TrainStatus = {
  readonly trainId: string;
  readonly phase: TrainPhase;
  readonly index: Int;
  readonly merged: Int;
  readonly total: Int;
  readonly step: TrainStep;
  readonly line: string;
  readonly cars: ReadonlyArray<TrainCar>;
  readonly stopReason: string | null;
  readonly isWithLead: boolean;
  readonly isStopRequested: boolean;
};

export type TrainOffer = {
  readonly actionId: ActionId;
  readonly isBusy: boolean;
  readonly method: MergeMethod;
  readonly orderLine: string;
  readonly entries: ReadonlyArray<TrainEntry>;
  readonly status: TrainStatus | null;
  readonly stopActionId: ActionId | null;
};

export type PullRequestFields = {
  readonly workspaceId: string;
  readonly sessionId: string;
  readonly number: Int;
  readonly title: string;
  readonly url: string;
  readonly phase: PullRequestPhase;
  readonly headSha: string;
  readonly baseBranch: string;
  readonly headBranch: string;
  readonly checks: ReadonlyArray<CheckRow>;
  readonly reviews: ReadonlyArray<ReviewRow>;
  readonly readiness: MergeReadiness;
  readonly methods: ReadonlyArray<MergeMethod>;
  readonly mergeActionId: ActionId | null;
  readonly changedFiles: Int | null;
  readonly additions: Int | null;
  readonly deletions: Int | null;
  readonly commitCount: Int | null;
  readonly reviewComments: Int;
  readonly train: TrainOffer | null;
};

export type PullRequestProjection = ProjectionMeta & PullRequestFields;

export type TaskRow = {
  readonly id: string;
  readonly provider: TaskProvider;
  readonly key: string;
  readonly title: string;
  readonly words: string;
  readonly sessionId: string | null;
  readonly canStart: boolean;
  readonly description: string | null;
  readonly assignee: string | null;
  readonly stateLabel: string | null;
};

export type StartProject = {
  readonly id: string;
  readonly name: string;
};

export type StartKindChoice = {
  readonly startKind: StartKind;
  readonly presetId: string | null;
  readonly label: string;
  readonly hasLimit: boolean;
  readonly hasStops: boolean;
};

export type StartStopsChoice = {
  readonly stops: StartStops;
  readonly label: string;
  readonly promise: string;
};

export type StartAccessChoice = {
  readonly access: SessionAccess;
  readonly label: string;
  readonly promise: string;
};

export type StartOffer = {
  readonly actionId: ActionId;
  readonly isPermitted: boolean;
  readonly projects: ReadonlyArray<StartProject>;
  readonly kinds: ReadonlyArray<StartKindChoice>;
  readonly accessChoices: ReadonlyArray<StartAccessChoice>;
  readonly defaultAccess: SessionAccess;
  readonly stopsChoices: ReadonlyArray<StartStopsChoice>;
  readonly defaultStops: StartStops;
  readonly limitAmounts: ReadonlyArray<number>;
  readonly defaultLimitUsd: number | null;
  readonly maxGoalLength: Int;
  readonly remainingToday: Int;
};

export type TasksFields = {
  readonly workspaceId: string;
  readonly count: Int;
  readonly rows: ReadonlyArray<TaskRow>;
  readonly start: StartOffer | null;
};

export type TasksProjection = ProjectionMeta & TasksFields;
