import type { GroupSummary, GroupSummaryPart } from '../../../session/timeline/groupSummary';

type Params = {
  readonly summary: GroupSummary;
  readonly duration: string | null;
  readonly cost: string | null;
};

const factPart = ({
  state,
  text,
}: {
  readonly state: string;
  readonly text: string;
}): GroupSummaryPart => ({
  state,
  tone: 'neutral',
  count: 0,
  noun: '',
  isFailure: false,
  text,
  isKept: true,
});

export const foldRowSummary = ({ summary, duration, cost }: Params): GroupSummary => ({
  ...summary,
  parts: [
    ...summary.parts,
    ...(duration === null ? [] : [factPart({ state: 'duration', text: duration })]),
    ...(cost === null ? [] : [factPart({ state: 'cost', text: cost })]),
  ],
});
