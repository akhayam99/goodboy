import type { ReactNode } from 'react';
import type { Tone } from '@goodboy/ui';
import type { LucideIcon } from 'lucide-react';

export type StudioShellProps = {
  readonly icon?: LucideIcon;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel: string;
  readonly headerAccessory?: ReactNode;
  readonly onClose: () => void;
  readonly isEscapeEnabled?: boolean;
  readonly variant?: 'fullscreen' | 'slot' | 'viewport';
  readonly children: (requestClose: () => void) => ReactNode;
};
