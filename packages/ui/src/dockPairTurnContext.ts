import { createContext } from 'react';
import type { IconGlyph } from './icons';

export type DockPairTurn = {
  readonly label: string;
  readonly icon: IconGlyph;
  readonly onTurn: () => void;
};

export const DockPairTurnContext = createContext<DockPairTurn | null>(null);
