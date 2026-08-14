import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CircleHelp,
  GitPullRequest,
  MessageSquareReply,
  Upload,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button, Chip, cn, tintClasses } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { NextUpItem, NextUpSignal } from './selectNextUp';

type Props = {
  readonly item: NextUpItem;
  readonly onAct: () => void;
};

const SIGNAL_ICON: Record<NextUpSignal, LucideIcon> = {
  question: CircleHelp,
  review: GitPullRequest,
  checks: XCircle,
  resume: Bot,
  stalled: AlertTriangle,
  errored: AlertCircle,
  resolve: MessageSquareReply,
};

const SIGNAL_LABEL: Record<NextUpSignal, string> = {
  question: 'questions',
  review: 'review',
  checks: 'ci failed',
  resume: 'unread',
  stalled: 'stalled',
  errored: 'errored',
  resolve: 'resolve',
};

const ITEM_ICON: Record<NextUpItem['id'], LucideIcon> = {
  question: CircleHelp,
  review: GitPullRequest,
  checks: XCircle,
  resume: Bot,
  resolve: MessageSquareReply,
  'pending-push': Upload,
  stalled: CONCEPT_ICONS.workflows,
  errored: AlertCircle,
  'close-out': GitPullRequest,
  start: CONCEPT_ICONS.workflows,
  'next-step': CONCEPT_ICONS.workflows,
  follow: Bot,
};

export const NextUpCard = ({ item, onAct }: Props) => {
  const tint = tintClasses(item.tone);
  const Icon = ITEM_ICON[item.id];

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-lg border bg-elevated px-4 py-3.5',
        tint.borderSoft,
        tint.bgSoft,
      )}
    >
      <Icon size={16} aria-hidden className={cn('shrink-0', tint.icon)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
        {item.detail !== '' ? (
          <span className="truncate text-2xs text-muted-foreground">{item.detail}</span>
        ) : null}
      </div>
      {item.signals.length > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {item.signals.map((signal) => {
            const SignalIcon = SIGNAL_ICON[signal];
            return (
              <Chip
                key={signal}
                tone="neutral"
                size="sm"
                icon={<SignalIcon size={11} aria-hidden />}
                label={SIGNAL_LABEL[signal]}
              />
            );
          })}
        </div>
      ) : null}
      <Button variant="primary" size="sm" data-weight="primary" onClick={onAct}>
        {item.action}
      </Button>
    </div>
  );
};
