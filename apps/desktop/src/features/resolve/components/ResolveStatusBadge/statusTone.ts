import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  CheckCheck,
  CircleSlash,
  GitCommit,
  HelpCircle,
  Loader,
  MessageSquare,
  Minus,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import type { ResolveQueueStatus } from '../../../../store/slices/resolve/deriveResolveQueueStatus';

export const BADGE_TONE_BY_STATUS: Record<ResolveQueueStatus, Tone> = {
  fix_ready: 'info',
  reply_ready: 'info',
  no_change: 'neutral',
  agent_asked: 'warning',
  working: 'info',
  ready_to_push: 'success',
  pushed: 'neutral',
  later: 'neutral',
  changed_since_accepted: 'warning',
  delivery_failed: 'danger',
  confirm_delivery: 'warning',
  run_failed: 'danger',
  run_stopped: 'warning',
  wont_fix: 'neutral',
  wont_fix_sent: 'neutral',
};

export const BADGE_ICON_BY_STATUS: Record<ResolveQueueStatus, LucideIcon> = {
  fix_ready: GitCommit,
  reply_ready: MessageSquare,
  no_change: Minus,
  agent_asked: HelpCircle,
  working: Loader,
  ready_to_push: CheckCheck,
  pushed: CheckCheck,
  later: CalendarClock,
  changed_since_accepted: RefreshCw,
  delivery_failed: XCircle,
  confirm_delivery: TriangleAlert,
  run_failed: XCircle,
  run_stopped: RotateCcw,
  wont_fix: CircleSlash,
  wont_fix_sent: CircleSlash,
};
