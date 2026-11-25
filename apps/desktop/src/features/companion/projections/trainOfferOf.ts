import type { MergeTrain } from '../../../store/slices/pr-series/mergeTrain';
import { trainLineOf } from '../../board/mergeTrain/trainLineOf';
import { stopTrainActionIdOf, trainActionIdOf } from '../actions/phoneActionIds';
import type {
  TrainCar,
  TrainCarState,
  TrainEntry,
  TrainOffer,
  TrainStatus,
} from '../contract/projections';
import type { StatusMark } from '../contract/vocabulary';
import type { WorkspaceScope } from './workspaceScope';

export const TRAIN_ORDER_LINE = 'Squash and merge, smallest change first';

const MIN_OFFER_SIZE = 2;

type StateParams = {
  readonly train: MergeTrain;
  readonly index: number;
};

const carStateOf = ({ train, index }: StateParams): TrainCarState => {
  if (index < train.merged) {
    return 'merged';
  }
  const { outcome } = train;
  if (outcome === null) {
    return index === train.index ? train.step : 'queued';
  }
  return outcome.kind === 'stopped' && index === train.merged ? 'stopped' : 'queued';
};

const MARK_OF: Readonly<Record<TrainCarState, StatusMark>> = {
  queued: { kind: 'state', state: 'queued' },
  merging: { kind: 'state', state: 'merging' },
  updating: { kind: 'state', state: 'merging' },
  waiting: { kind: 'state', state: 'merging' },
  merged: { kind: 'state', state: 'merged' },
  stopped: { kind: 'state', state: 'stopped' },
};

type LineParams = {
  readonly state: TrainCarState;
  readonly base: string;
};

const WORDS: Readonly<Record<TrainCarState, string>> = {
  queued: 'Next in line',
  merging: 'Merging',
  updating: 'Updating',
  waiting: 'Checks running',
  merged: 'Merged',
  stopped: 'Stopped here',
};

const carWordsOf = ({ state, base }: LineParams): string =>
  state === 'updating' ? `${WORDS.updating} on ${base}` : WORDS[state];

type StatusParams = {
  readonly train: MergeTrain;
};

const statusOf = ({ train }: StatusParams): TrainStatus => {
  const { outcome } = train;
  const cars = train.cars.map((car, index): TrainCar => {
    const state = carStateOf({ train, index });
    return {
      sessionId: car.sessionId,
      prNumber: car.prNumber,
      state,
      mark: MARK_OF[state],
      line: `#${car.prNumber} ${car.repo} · ${carWordsOf({ state, base: car.base })}`,
    };
  });
  return {
    trainId: train.id,
    phase: outcome === null ? 'running' : outcome.kind,
    index: train.index,
    merged: train.merged,
    total: train.cars.length,
    step: train.step,
    line: trainLineOf({ train }),
    cars,
    stopReason: outcome !== null && outcome.kind === 'stopped' ? outcome.reason : null,
    isWithLead: outcome !== null && outcome.kind === 'stopped' ? outcome.isWithLead : false,
    isStopRequested: train.isStopRequested,
  };
};

type Params = {
  readonly scope: WorkspaceScope;
};

export const trainOfferOf = ({ scope }: Params): TrainOffer | null => {
  const { mergeTrain: train } = scope;
  const entries = scope.readyLines.map((line): TrainEntry => ({
    sessionId: line.sessionId,
    prNumber: line.prNumber,
    headSha: line.headSha,
    title: line.title,
    repo: line.repo,
    reason: line.reason,
  }));
  const isBusy = train !== null && train.outcome === null;
  if (train === null && entries.length < MIN_OFFER_SIZE) {
    return null;
  }
  return {
    actionId: trainActionIdOf({
      workspaceId: scope.workspace.id,
      entries: entries.map((entry) => ({
        sessionId: entry.sessionId,
        prNumber: entry.prNumber,
        expectedHeadSha: entry.headSha,
      })),
    }),
    isBusy,
    method: 'squash',
    orderLine: TRAIN_ORDER_LINE,
    entries,
    status: train === null ? null : statusOf({ train }),
    stopActionId:
      train !== null && train.outcome === null && !train.isStopRequested
        ? stopTrainActionIdOf({ trainId: train.id })
        : null,
  };
};
