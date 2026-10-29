import type { IsoDateTime } from '@goodboy/types';
import { formatDayLabel } from './lib';

type Props = {
  at: IsoDateTime;
};

export const DayDivider = ({ at }: Props) => (
  <li data-testid="transcript-day" data-align="start" className="flex justify-start">
    <span className="text-meta text-muted-foreground">{formatDayLabel(at)}</span>
  </li>
);
