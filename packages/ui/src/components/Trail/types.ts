import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type TrailSegmentView = {
  readonly isIconOnly: boolean;
};

export type TrailSegmentModel = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly iconClassName?: string;
  readonly glyph?: ReactNode;
  readonly accessory?: ReactNode;
  readonly onSelect?: () => void;
  readonly render?: (view: TrailSegmentView) => ReactNode;
  readonly isPinned?: boolean;
};
