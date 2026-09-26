import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { CrumbMenuModel } from './crumbMenuTypes';

export type TrailSegmentModel = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly iconClassName?: string;
  readonly glyph?: ReactNode;
  readonly accessory?: ReactNode;
  readonly onSelect?: () => void;
  readonly menu?: CrumbMenuModel | null;
  readonly isPinned?: boolean;
};
