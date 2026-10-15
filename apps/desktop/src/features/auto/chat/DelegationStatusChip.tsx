import type { ReactNode } from 'react';
import { Check, Clock, Pause, Square, TriangleAlert, X } from 'lucide-react';
import { Chip, ICON_SIZE } from '@goodboy/ui';
import type { DelegationStatus } from './delegationCardOf';

type Props = {
  readonly status: DelegationStatus;
};

const ICON_BY_WORD: Readonly<Record<string, typeof Check>> = {
  Done: Check,
  Failed: X,
  Blocked: TriangleAlert,
  'Timed out': Clock,
  Stopped: Square,
  Queued: Clock,
  'Needs your OK': Pause,
  'Waiting for an answer': Pause,
};

const LIVE_DOT = (
  <span
    aria-hidden
    className="size-1.5 shrink-0 rounded-full bg-current motion-safe:animate-soft-pulse"
  />
);

const iconOf = ({ status }: Props): ReactNode => {
  if (status.isLive) {
    return LIVE_DOT;
  }
  const Icon = ICON_BY_WORD[status.word];
  return Icon === undefined ? null : <Icon size={ICON_SIZE.control} aria-hidden />;
};

export const DelegationStatusChip = ({ status }: Props) => (
  <Chip
    kind="state"
    tone={status.tone}
    shape="badge"
    icon={iconOf({ status })}
    label={status.word}
  />
);
