import { Circle, CircleCheck, Contrast, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn, tintClasses, type Tone } from '@goodboy/ui';
import { ICON_SIZE } from '../../../shared/components/conceptIcons';
import type { InboxState } from '../types';

type Presentation = {
  readonly icon: LucideIcon;
  readonly tone: Tone;
};

const INBOX_STATE_PRESENTATION = {
  open: { icon: Circle, tone: 'info' },
  active: { icon: Contrast, tone: 'warning' },
  done: { icon: CircleCheck, tone: 'neutral' },
  alert: { icon: TriangleAlert, tone: 'danger' },
} satisfies Record<InboxState, Presentation>;

type Props = {
  readonly state: InboxState;
  readonly label: string;
  readonly className?: string;
};

export const InboxStateLabel = ({ state, label, className }: Props) => {
  const { icon: Icon, tone } = INBOX_STATE_PRESENTATION[state];
  return (
    <span className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <Icon size={ICON_SIZE.row} aria-hidden className={cn('shrink-0', tintClasses(tone).icon)} />
      <span className="truncate">{label}</span>
    </span>
  );
};
