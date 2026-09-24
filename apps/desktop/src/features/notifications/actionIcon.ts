import { ChevronRight, RotateCcw, type LucideIcon } from 'lucide-react';
import type { NotificationAction } from '@goodboy/db';

type ActionIconParams = {
  readonly kind: NotificationAction['kind'];
};

export const notificationActionIcon = ({ kind }: ActionIconParams): LucideIcon => {
  switch (kind) {
    case 'retry-summarizer':
    case 'retry-step-summary':
    case 'retry-publication':
    case 'retry-update':
      return RotateCcw;
    case 'open-agent':
    case 'open-budget':
    case 'open-orphan-worktrees':
    case 'open-lens':
    case 'update-provider-cli':
      return ChevronRight;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};
