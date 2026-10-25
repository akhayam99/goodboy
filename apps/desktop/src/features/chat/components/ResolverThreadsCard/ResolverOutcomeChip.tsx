import { Ban, CheckCheck, CircleHelp, Lock, Search } from 'lucide-react';
import { Chip, ICON_SIZE, type Tone } from '@goodboy/ui';
import type { ResolverThreadVerdictKind } from './resolverThreadVerdicts';
import { RESOLVER_OUTCOME_LABEL, resolverOutcome } from './resolverOutcome';

type Props = {
  readonly kind: ResolverThreadVerdictKind;
  readonly isClosed: boolean;
};

const TONE: Record<ResolverThreadVerdictKind, Tone> = {
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
} satisfies Record<ResolverThreadVerdictKind, typeof CheckCheck>;

const CLOSED_TONE: Tone = 'success';

export const ResolverOutcomeChip = ({ kind, isClosed }: Props) => {
  const Icon = isClosed ? Lock : ICON[kind];

  return (
    <Chip
      kind="state"
      tone={isClosed ? CLOSED_TONE : TONE[kind]}
      width="md"
      emphasis="subtle"
      bordered={false}
      icon={<Icon size={ICON_SIZE.mark} aria-hidden />}
      label={RESOLVER_OUTCOME_LABEL[resolverOutcome({ kind, isClosed })]}
      className="shrink-0"
    />
  );
};
