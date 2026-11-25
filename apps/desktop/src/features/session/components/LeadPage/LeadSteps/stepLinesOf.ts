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

type ProgressParams = {
  readonly role: string | null;
  readonly turn: number;
  readonly delegations: ReadonlyArray<AutoDelegation>;
};

const stepProgressOf = ({ role, turn, delegations }: ProgressParams): StepState => {
  if (role === null) {
    return 'queued';
  }
  const own = delegations
    .filter((delegation) => delegation.role === role && delegation.state !== 'awaiting_confirm')
    .sort((first, second) => first.createdAt - second.createdAt)[turn];
  if (own === undefined) {
    return 'queued';
  }
  return own.outcome === 'completed' ? 'done' : own.outcome === null ? 'running' : 'queued';
};

const HELD_NOTE = 'Stopped at the first check';

export const stepLinesOf = ({ guide, delegations }: Params): ReadonlyArray<StepLine> => {
  const roleSeen = new Map<string, number>();
  const base = guide.steps.map((step, index): StepLine => {
    const turn = step.role === null ? 0 : (roleSeen.get(step.role) ?? 0);
    if (step.role !== null) {
      roleSeen.set(step.role, turn + 1);
    }
    const skipped = guide.deviations.find(
      (deviation) =>
        deviation.change === 'skipped' && stepKeyOf({ name: deviation.step }) === stepKeyOf(step),
    );
    const moved = guide.deviations.find(
      (deviation) =>
        deviation.change === 'moved' && stepKeyOf({ name: deviation.step }) === stepKeyOf(step),
    );
    return {
      key: `step-${index}`,
      ordinal: String(index + 1),
      name: step.name,
      state:
        skipped === undefined ? stepProgressOf({ role: step.role, turn, delegations }) : 'skipped',
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
