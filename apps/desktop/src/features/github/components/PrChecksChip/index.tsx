import { Check, Clock, XCircle, type LucideIcon } from 'lucide-react';
import { Chip, type Tone } from '@goodboy/ui';
import type { PrCheckRun } from '@goodboy/types';
import { prChecksSummary, type PrChecksState } from './prChecksSummary';

type ChecksMeta = {
  readonly tone: Tone;
  readonly label: string;
  readonly icon: LucideIcon;
};

const CHECKS_META: Record<Exclude<PrChecksState, 'none'>, ChecksMeta> = {
  success: { tone: 'success', label: 'CI passing', icon: Check },
  failure: { tone: 'danger', label: 'CI failing', icon: XCircle },
  pending: { tone: 'warning', label: 'CI running', icon: Clock },
};

type Props = {
  readonly checks: ReadonlyArray<PrCheckRun>;
};

export const PrChecksChip = ({ checks }: Props) => {
  const state = prChecksSummary({ checks });

  if (state === 'none') {
    return <span className="text-2xs text-muted-foreground/70">No CI</span>;
  }

  const meta = CHECKS_META[state];
  const Icon = meta.icon;

  return (
    <Chip tone={meta.tone} size="sm" icon={<Icon size={11} aria-hidden />} label={meta.label} />
  );
};
