import type { ReactNode } from 'react';
import type { IconGlyph } from '../../icons';
import type { CrumbMenuModel } from './crumbMenuTypes';

export type TrailSegmentModel = {
  readonly id: string;
  readonly label: string;
  readonly icon: IconGlyph;
  readonly iconClassName?: string;
  readonly glyph?: ReactNode;
  readonly accessory?: ReactNode;
  readonly onSelect?: () => void;
  readonly tooltip?: string;
  readonly shortcut?: string;
  readonly menu?: CrumbMenuModel | null;
  readonly isPinned?: boolean;
};
