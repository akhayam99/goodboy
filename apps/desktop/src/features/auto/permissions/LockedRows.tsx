import { Lock } from 'lucide-react';
import { ICON_SIZE } from '@goodboy/ui';
import type { LeadLockedRow } from '@goodboy/core/auto';

type Copy = Readonly<{ strong: string; rest: string }>;

const LOCKED_COPY: Readonly<Record<LeadLockedRow, Copy>> = {
  forcePushAsks: { strong: 'Force push', rest: ' always asks, and keeps a backup.' },
  mergeIsYou: { strong: 'Merge', rest: ' is always you.' },
  agentsNeverPush: { strong: 'Agents never push.', rest: ' Goodboy pushes what they committed.' },
  leadNeverWrites: {
    strong: 'The Lead never writes.',
    rest: ' It reads, plans and starts agents.',
  },
};

type Props = {
  readonly rows: ReadonlyArray<LeadLockedRow>;
};

export const LockedRows = ({ rows }: Props) => (
  <ul aria-label="Always on" className="flex flex-col gap-2">
    {rows.map((row) => (
      <li key={row} className="flex items-center gap-2 text-meta text-muted-foreground">
        <Lock size={ICON_SIZE.row} aria-hidden className="shrink-0 text-faint-foreground" />
        <span>
          <span className="text-foreground">{LOCKED_COPY[row].strong}</span>
          {LOCKED_COPY[row].rest}
        </span>
      </li>
    ))}
  </ul>
);
