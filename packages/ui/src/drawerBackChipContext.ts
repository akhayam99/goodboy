import { createContext } from 'react';

export type DrawerChip = {
  readonly kind: string;
  readonly title: string | null;
  readonly onBack: () => void;
};

export const DrawerBackChipContext = createContext<DrawerChip | null>(null);
