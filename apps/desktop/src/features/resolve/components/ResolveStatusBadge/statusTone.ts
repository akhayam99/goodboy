import type { LucideIcon } from 'lucide-react';
import {
  CalendarClock,
  CheckCheck,
  Circle,
  GitCommit,
  HelpCircle,
  Loader,
  XCircle,
} from 'lucide-react';
import type { Tone } from '@goodboy/ui';
import type { ResolveUiState } from '../../resolveRowState';

export const BADGE_TONE_BY_STATUS: Record<ResolveUiState, Tone> = {
  new: 'neutral',
  working: 'info',
  needs_you: 'warning',
  ready: 'info',
  approved: 'success',
  resolved: 'neutral',
  failed: 'danger',
  later: 'neutral',
};

export const BADGE_ICON_BY_STATUS: Record<ResolveUiState, LucideIcon> = {
  new: Circle,
  working: Loader,
  needs_you: HelpCircle,
  ready: GitCommit,
  approved: CheckCheck,
  resolved: CheckCheck,
  failed: XCircle,
  later: CalendarClock,
};
