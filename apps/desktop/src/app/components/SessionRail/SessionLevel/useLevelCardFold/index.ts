import { useCallback, useState } from 'react';
import { STORAGE_KEYS, persistedPref } from '../../../../../shared/lib/storage-keys';

type LevelCardId = 'projects' | 'linked';

type Params = {
  readonly card: LevelCardId;
};

export type LevelCardFold = {
  readonly isOpen: boolean;
  readonly toggle: () => void;
};

const isCardId = (value: unknown): value is LevelCardId =>
  value === 'projects' || value === 'linked';

const foldedCardsPref = persistedPref<ReadonlyArray<LevelCardId>>({
  key: STORAGE_KEYS.sessionRailFoldedCards,
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isCardId) : undefined;
  },
  fallback: [],
});

export const useLevelCardFold = ({ card }: Params): LevelCardFold => {
  const [isOpen, setIsOpen] = useState(() => !foldedCardsPref.read().includes(card));
  const toggle = useCallback(() => {
    const isNowOpen = !isOpen;
    const others = foldedCardsPref.read().filter((folded) => folded !== card);
    foldedCardsPref.write(isNowOpen ? others : [...others, card]);
    setIsOpen(isNowOpen);
  }, [card, isOpen]);
  return { isOpen, toggle };
};
