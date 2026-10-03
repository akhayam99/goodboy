import type { Tone } from '@goodboy/ui';

export type GroupSummaryPart<State extends string = string> = {
  readonly state: State;
  readonly tone: Tone;
  readonly count: number;
  readonly noun: string;
  readonly isFailure: boolean;
};

export type GroupSummary<State extends string = string> = {
  readonly total: number;
  readonly parts: ReadonlyArray<GroupSummaryPart<State>>;
  readonly attentionCount: number;
  readonly failedCount: number;
};

type PartsParams<State extends string> = {
  readonly counts: ReadonlyMap<State, number>;
  readonly order: ReadonlyArray<State>;
  readonly nounOf: (params: { readonly state: State; readonly count: number }) => string;
  readonly toneOf: (params: { readonly state: State }) => Tone;
  readonly failure: State | null;
};

export const groupSummaryParts = <State extends string>({
  counts,
  order,
  nounOf,
  toneOf,
  failure,
}: PartsParams<State>): ReadonlyArray<GroupSummaryPart<State>> =>
  order.flatMap((state): ReadonlyArray<GroupSummaryPart<State>> => {
    const count = counts.get(state) ?? 0;
    if (count === 0) {
      return [];
    }
    return [
      {
        state,
        tone: toneOf({ state }),
        count,
        noun: nounOf({ state, count }),
        isFailure: state === failure,
      },
    ];
  });

export const groupSummaryText = ({ summary }: { readonly summary: GroupSummary }): string =>
  summary.parts.map((part) => `${part.count} ${part.noun}`).join(' · ');

export type StepsGroupKind = 'run' | 'chain';

type StepsState = 'steps' | 'answered';

const STEPS_ORDER: ReadonlyArray<StepsState> = ['steps', 'answered'];

const plural = ({
  count,
  one,
  many,
}: {
  readonly count: number;
  readonly one: string;
  readonly many: string;
}) => (count === 1 ? one : many);

type StepsSummaryParams = {
  readonly kind: StepsGroupKind;
  readonly steps: number;
  readonly answered: number;
};

export const stepsGroupSummary = ({
  kind,
  steps,
  answered,
}: StepsSummaryParams): GroupSummary<StepsState> => {
  const counts = new Map<StepsState, number>([
    ['steps', steps],
    ['answered', answered],
  ]);
  return {
    total: steps,
    parts: groupSummaryParts({
      counts,
      order: STEPS_ORDER,
      nounOf: ({ state, count }) =>
        state === 'answered'
          ? `${plural({ count, one: 'question', many: 'questions' })} answered`
          : kind === 'run'
            ? plural({ count, one: 'step', many: 'steps' })
            : plural({ count, one: 'subagent', many: 'subagents' }),
      toneOf: () => 'neutral',
      failure: null,
    }),
    attentionCount: 0,
    failedCount: 0,
  };
};
