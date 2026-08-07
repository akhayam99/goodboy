import { Ban, CheckCheck, CircleHelp, Lock, Search } from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { ResolverThreadSettlementKind } from '../../resolverThreadSettlements';

type Props = {
  readonly kind: ResolverThreadSettlementKind;
  readonly isClosed: boolean;
};

const COPY: Record<ResolverThreadSettlementKind, string> = {
  resolved: 'fixed',
  wontfix: 'no change',
  analyzed: 'explained',
  open: 'needs you',
};

const TONE: Record<ResolverThreadSettlementKind, Tone> = {
  resolved: 'success',
  wontfix: 'warning',
  analyzed: 'info',
  open: 'warning',
};

const ICON = {
  resolved: CheckCheck,
  wontfix: Ban,
  analyzed: Search,
  open: CircleHelp,
} satisfies Record<ResolverThreadSettlementKind, typeof CheckCheck>;

const CLOSED_COPY = 'closed';

const CLOSED_TONE: Tone = 'success';

export const ResolverOutcomeChip = ({ kind, isClosed }: Props) => {
  const tint = tintClasses(isClosed ? CLOSED_TONE : TONE[kind]);
  const Icon = isClosed ? Lock : ICON[kind];

  return (
    <span
      className={cn(
        'inline-flex min-w-24 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-2xs font-medium',
        tint.bgSoft,
        tint.text,
      )}
    >
      <Icon size={10} aria-hidden />
      {isClosed ? CLOSED_COPY : COPY[kind]}
    </span>
  );
};
