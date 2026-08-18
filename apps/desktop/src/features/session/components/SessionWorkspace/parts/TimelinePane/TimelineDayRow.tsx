import type { RunIdentity } from '../../../../timeline/runIdentity';
import { TimelineSpine } from './TimelineSpine';

type Props = {
  readonly label: string;
  readonly identity: RunIdentity | null;
};

export const TimelineDayRow = ({ label, identity }: Props) => (
  <div className="grid grid-cols-[52px_minmax(0,1fr)] items-center">
    <span className="pr-2 text-right text-3xs font-medium uppercase tracking-eyebrow text-muted-foreground">
      {label}
    </span>
    <div className="relative flex min-w-0 items-stretch py-3">
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-soft" />
      <TimelineSpine identity={identity} />
    </div>
  </div>
);
