import { Eye } from 'lucide-react';
import { Eyebrow, ICON_SIZE, StateBadge } from '@goodboy/ui';
import type { RoleRunFacts } from './roleRunFacts';

type Props = {
  readonly label: string;
  readonly facts: RoleRunFacts;
};

const TERM = 'text-meta text-faint-foreground';
const VALUE = 'flex min-w-0 flex-col gap-0.5 text-label text-foreground';
const NOTE = 'text-meta text-muted-foreground';

export const RoleHowItRuns = ({ label, facts }: Props) => (
  <section
    aria-label={`How ${label} runs`}
    className="flex flex-col gap-2 rounded-md border border-border bg-background p-3"
  >
    <header className="flex items-center justify-between gap-2">
      <Eyebrow label={`How ${label} runs`} icon={<Eye size={ICON_SIZE.row} aria-hidden />} />
      <StateBadge>Read only</StateBadge>
    </header>
    <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-2">
      <dt className={TERM}>What it does</dt>
      <dd className={VALUE}>{facts.does}</dd>
      <dt className={TERM}>Auto picks</dt>
      <dd className={VALUE}>
        <span className="w-fit rounded-sm bg-subtle px-2">{facts.auto.label}</span>
        <span className={NOTE}>{facts.autoReason}</span>
      </dd>
      <dt className={TERM}>Splits</dt>
      <dd className={VALUE}>
        <span>{facts.split.headline}</span>
        <span className={NOTE}>{facts.split.note}</span>
      </dd>
      <dt className={TERM}>Can launch</dt>
      <dd className={VALUE}>{facts.launch}</dd>
    </dl>
  </section>
);
