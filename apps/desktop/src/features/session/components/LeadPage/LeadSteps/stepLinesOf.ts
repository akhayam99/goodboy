import type { AutoDelegation } from '@goodboy/db';
import type { AutoGuideView } from '../../../../../store/slices/auto-view/state';

export type StepState = 'done' | 'running' | 'attention' | 'skipped' | 'queued' | 'added';

export type StepLine = Readonly<{
  key: string;
  ordinal: string;
  name: string;
  state: StepState;
  note: string | null;
  change: 'added' | 'moved' | null;
  reason: string | null;
}>;

type Params = {
  readonly guide: AutoGuideView;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

type NameParams = {
  readonly name: string;
};

const stepKeyOf = ({ name }: NameParams): string => name.trim().toLowerCase();

type ChainParams = {
  readonly role: string;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

const MAX_RETRIES = 20;

const attemptsOfRole = ({ role, delegations }: ChainParams): ReadonlyArray<AutoDelegation> => {
  const own = delegations.filter((delegation) => delegation.role === role);
  const retryOf = new Map(
    own.flatMap((delegation) =>
      delegation.retryOf === null ? [] : [[String(delegation.retryOf), delegation] as const],
    ),
  );
  const ids = new Set(own.map((delegation) => String(delegation.id)));
  return own
    .filter((delegation) => delegation.retryOf === null || !ids.has(String(delegation.retryOf)))
    .sort((first, second) => first.createdAt - second.createdAt)
    .map((first) => {
      let latest = first;
      for (let step = 0; step < MAX_RETRIES; step += 1) {
        const next = retryOf.get(String(latest.id));
        if (next === undefined) {
          break;
        }
        latest = next;
      }
      return latest;
    });
};

type ProgressParams = {
  readonly attempt: AutoDelegation | undefined;
};

const stepProgressOf = ({ attempt }: ProgressParams): StepState => {
  if (attempt === undefined) {
    return 'queued';
  }
  if (attempt.state === 'settled') {
    return attempt.outcome === 'completed' ? 'done' : 'queued';
  }
  return attempt.state === 'running' || attempt.state === 'starting' ? 'running' : 'queued';
};

const HELD_NOTE = 'Stopped at the first check';

export const stepLinesOf = ({ guide, delegations }: Params): ReadonlyArray<StepLine> => {
  const roleSeen = new Map<string, number>();
  const base = guide.steps.map((step, index): StepLine => {
    const skipped = guide.deviations.find(
      (deviation) =>
        deviation.change === 'skipped' && stepKeyOf({ name: deviation.step }) === stepKeyOf(step),
    );
    const moved = guide.deviations.find(
      (deviation) =>
        deviation.change === 'moved' && stepKeyOf({ name: deviation.step }) === stepKeyOf(step),
    );
    const turn = step.role === null ? 0 : (roleSeen.get(step.role) ?? 0);
    if (step.role !== null && skipped === undefined) {
      roleSeen.set(step.role, turn + 1);
    }
    return {
      key: `step-${index}`,
      ordinal: String(index + 1),
      name: step.name,
      state:
        skipped !== undefined
          ? 'skipped'
          : stepProgressOf({
              attempt:
                step.role === null
                  ? undefined
                  : attemptsOfRole({ role: step.role, delegations })[turn],
            }),
      note: skipped === undefined ? null : `Skipped: ${skipped.reason}`,
      change: moved === undefined ? null : 'moved',
      reason: moved?.reason ?? null,
    };
  });
  const added = guide.deviations
    .filter((deviation) => deviation.change === 'added')
    .map((deviation, index): StepLine => ({
      key: `added-${index}`,
      ordinal: '+',
      name: deviation.step,
      state: 'added',
      note: null,
      change: 'added',
      reason: deviation.reason,
    }));
  const lines = [...base, ...added];
  if (guide.check !== 'held') {
    return lines;
  }
  const first = lines.findIndex((line) => line.state === 'queued');
  return lines.map((line, index) =>
    index === first ? { ...line, state: 'attention', note: HELD_NOTE } : line,
  );
};
