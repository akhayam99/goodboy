import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export const LAYER_CRUMB_PREFIX = 'layer-';

export type BreadcrumbCrumb = {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly iconClassName?: string;
  readonly accessory?: ReactNode;
  readonly onClick?: () => void;
};
