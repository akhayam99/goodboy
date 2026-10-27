import { ChevronRight, RotateCcw, type LucideIcon } from 'lucide-react';
import type { NotificationAction } from '@goodboy/db';

type ActionIconParams = {
  readonly kind: NotificationAction['kind'];
};

export const notificationActionIcon = ({ kind }: ActionIconParams): LucideIcon => {
  switch (kind) {
    case 'retry-summarizer':
    case 'retry-step-summary':
    case 'retry-orchestrator':
    case 'retry-publication':
    case 'retry-update':
    case 'retry-push':
      return RotateCcw;
    case 'open-agent':
    case 'open-budget':
    case 'open-orphan-worktrees':
    case 'open-storage':
    case 'open-lens':
    case 'open-activity':
    case 'open-settings':
    case 'reveal-path':
    case 'update-provider-cli':
      return ChevronRight;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};
