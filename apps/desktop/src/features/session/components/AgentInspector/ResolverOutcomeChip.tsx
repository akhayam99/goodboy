import { Ban, CheckCheck, CircleHelp, Search } from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import type { ResolverThreadSettlementKind } from '../../resolverThreadSettlements';

type Props = {
  readonly kind: ResolverThreadSettlementKind;
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

export const ResolverOutcomeChip = ({ kind }: Props) => {
  const tint = tintClasses(TONE[kind]);
  const Icon = ICON[kind];

  return (
    <span
      className={cn(
        'inline-flex min-w-24 shrink-0 items-center justify-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
        tint.bgSoft,
        tint.text,
      )}
    >
      <Icon size={10} aria-hidden />
      {COPY[kind]}
    </span>
  );
};
