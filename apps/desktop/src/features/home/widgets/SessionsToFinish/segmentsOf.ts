import type { Tone } from '@goodboy/ui';
import type { StageCounts } from '../../hooks/useHomeFacts';

export type Segment = {
  readonly key: keyof StageCounts;
  readonly label: string;
  readonly count: number;
  readonly tone: Tone;
};

type Params = {
  readonly counts: StageCounts;
};

export const segmentsOf = ({ counts }: Params): ReadonlyArray<Segment> =>
  [
    { key: 'needsYou', label: 'need you', count: counts.needsYou, tone: 'warning' },
    { key: 'running', label: 'running', count: counts.running, tone: 'info' },
    { key: 'review', label: 'in review', count: counts.review, tone: 'success' },
    { key: 'open', label: 'open', count: counts.open, tone: 'neutral' },
  ] satisfies ReadonlyArray<Segment>;
