import type { AutoTreeView } from './state';

const CLOCK_STEP_MS = 15_000;

type Params = {
  readonly views: ReadonlyArray<AutoTreeView>;
  readonly now: number;
  readonly previous: number;
};

const isWaitingToStart = ({ views }: Pick<Params, 'views'>): boolean =>
  views.some((view) =>
    view.delegations.some(
      (delegation) =>
        (delegation.state === 'accepted' || delegation.state === 'starting') &&
        delegation.settledAt === null,
    ),
  );

export const autoClockOf = ({ views, now, previous }: Params): number => {
  if (!isWaitingToStart({ views })) {
    return previous;
  }
  return Math.max(previous, Math.floor(now / CLOCK_STEP_MS) * CLOCK_STEP_MS);
};
