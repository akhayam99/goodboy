import { CircleAlert, TriangleAlert, CheckCircle, Info, type IconGlyph } from '@goodboy/ui/icons';
import type { NotificationSeverity } from '@goodboy/db';
import type { Tone } from '@goodboy/ui';

type SeverityPresentation = {
  readonly icon: IconGlyph;
  readonly tone: Tone;
  readonly label: string;
};

export const NOTIFICATION_SEVERITY = {
  success: { icon: CheckCircle, tone: 'success', label: 'Done' },
  info: { icon: Info, tone: 'info', label: 'Info' },
  warning: { icon: TriangleAlert, tone: 'warning', label: 'Warning' },
  error: { icon: CircleAlert, tone: 'danger', label: 'Error' },
} satisfies Record<NotificationSeverity, SeverityPresentation>;
