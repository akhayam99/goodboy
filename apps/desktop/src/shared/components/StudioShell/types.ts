import type { ReactNode } from 'react';
import type { Tone } from '@goodboy/ui';
import type { IconGlyph } from '@goodboy/ui/icons';

export type StudioShellProps = {
  readonly icon?: IconGlyph;
  readonly tone?: Tone;
  readonly glyph?: ReactNode;
  readonly title: string;
  readonly subtitle?: string;
  readonly closeLabel?: string;
  readonly headerAccessory?: ReactNode;
  readonly onClose: () => void;
  readonly isEscapeEnabled?: boolean;
  readonly variant?: 'fullscreen' | 'slot';
  readonly children: (requestClose: () => void) => ReactNode;
};
