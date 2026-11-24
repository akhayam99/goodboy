import type { MergeTrain } from '../../../store/slices/pr-series/mergeTrain';

type Params = {
  readonly train: MergeTrain;
};

export const trainLineOf = ({ train }: Params): string => {
  const total = train.cars.length;
  const { outcome } = train;
  if (outcome !== null && outcome.kind === 'done') {
    return `Merged ${train.merged} of ${total}`;
  }
  if (outcome !== null && outcome.kind === 'halted') {
    return `Stopped after ${train.merged} of ${total}`;
  }
  if (outcome !== null) {
    return `Merged ${train.merged} of ${total} · ${outcome.reason}`;
  }
  const car = train.cars[train.index];
  if (car === undefined) {
    return `Merging ${train.index + 1} of ${total}`;
  }
  if (train.step === 'updating') {
    return `Updating #${car.prNumber} on ${car.base}`;
  }
  if (train.step === 'waiting' && train.hasUpdated) {
    return `Updating #${car.prNumber} on ${car.base} · checks running`;
  }
  const merging = `Merging ${train.index + 1} of ${total} · #${car.prNumber} ${car.repo}`;
  return train.step === 'waiting' ? `${merging} · checks running` : merging;
};
