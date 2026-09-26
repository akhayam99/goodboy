import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export type TrailSegmentModel = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon | null;
  readonly iconClassName?: string;
  readonly accessory?: ReactNode;
  readonly onSelect?: () => void;
  readonly render?: ReactNode;
  readonly className?: string;
};
