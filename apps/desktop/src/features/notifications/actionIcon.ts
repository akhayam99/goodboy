import { ChevronRight, RotateCcw, type IconGlyph } from '@goodboy/ui/icons';
import type { NotificationAction } from '@goodboy/db';

type ActionIconParams = {
  readonly kind: NotificationAction['kind'];
};

export const notificationActionIcon = ({ kind }: ActionIconParams): IconGlyph => {
  switch (kind) {
    case 'retry-summarizer':
    case 'retry-step-summary':
    case 'retry-orchestrator':
    case 'retry-publication':
    case 'retry-update':
    case 'retry-notification-scope':
    case 'retry-push':
    case 'continue-agent':
      return RotateCcw;
    case 'open-agent':
    case 'open-budget':
    case 'open-orphan-worktrees':
    case 'open-storage':
    case 'open-lens':
    case 'open-activity':
    case 'open-place':
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
