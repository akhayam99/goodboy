import { useCallback, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

export type ListboxKeyItem = {
  readonly label: string;
  readonly isDisabled: boolean;
};

type Params = {
  readonly items: ReadonlyArray<ListboxKeyItem>;
  readonly isOpen: boolean;
  readonly isTypeaheadEnabled: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onCommit: (index: number) => void;
  readonly onTab: () => void;
};

type StepParams = {
  readonly items: ReadonlyArray<ListboxKeyItem>;
  readonly from: number;
  readonly delta: number;
};

type EdgeParams = {
  readonly items: ReadonlyArray<ListboxKeyItem>;
  readonly isLast: boolean;
};

type TypeaheadParams = {
  readonly items: ReadonlyArray<ListboxKeyItem>;
  readonly from: number;
  readonly buffer: string;
};

export type ListboxKeyboard = {
  readonly activeIndex: number;
  readonly setActiveIndex: (index: number) => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

const PAGE = 8;
const TYPEAHEAD_RESET_MS = 500;
const OPEN_KEYS = new Set(['Enter', ' ', 'ArrowDown', 'ArrowUp']);

export const edgeIndex = ({ items, isLast }: EdgeParams): number => {
  const indices = items.map((_, index) => index).filter((index) => !items[index]?.isDisabled);
  const found = isLast ? indices[indices.length - 1] : indices[0];
  return found ?? -1;
};

export const stepIndex = ({ items, from, delta }: StepParams): number => {
  const direction = delta > 0 ? 1 : -1;
  let landed = from;
  let remaining = Math.abs(delta);
  for (
    let index = from + direction;
    index >= 0 && index < items.length && remaining > 0;
    index += direction
  ) {
    if (items[index]?.isDisabled === true) {
      continue;
    }
    landed = index;
    remaining -= 1;
  }
  if (landed === -1) {
    return edgeIndex({ items, isLast: direction < 0 });
  }
  return landed;
};

const typeaheadIndex = ({ items, from, buffer }: TypeaheadParams): number => {
  const needle = buffer.toLowerCase();
  const count = items.length;
  const offset = buffer.length === 1 ? 1 : 0;
  for (let step = 0; step < count; step += 1) {
    const index = (Math.max(from, 0) + offset + step) % count;
    const item = items[index];
    if (item !== undefined && !item.isDisabled && item.label.toLowerCase().startsWith(needle)) {
      return index;
    }
  }
  return -1;
};

const isPrintable = (event: KeyboardEvent<HTMLElement>): boolean =>
  event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;

export const useListboxKeyboard = ({
  items,
  isOpen,
  isTypeaheadEnabled,
  onOpen,
  onClose,
  onCommit,
  onTab,
}: Params): ListboxKeyboard => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const buffer = useRef('');
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const typeahead = useCallback(
    (char: string) => {
      buffer.current = `${buffer.current}${char}`;
      if (bufferTimer.current !== null) {
        clearTimeout(bufferTimer.current);
      }
      bufferTimer.current = setTimeout(() => {
        buffer.current = '';
      }, TYPEAHEAD_RESET_MS);
      const found = typeaheadIndex({ items, from: activeIndex, buffer: buffer.current });
      if (found !== -1) {
        setActiveIndex(found);
      }
    },
    [activeIndex, items],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (!isOpen) {
        if (OPEN_KEYS.has(event.key)) {
          event.preventDefault();
          onOpen();
        }
        return;
      }
      const move = (index: number) => {
        event.preventDefault();
        setActiveIndex(index);
      };
      switch (event.key) {
        case 'ArrowDown':
          move(stepIndex({ items, from: activeIndex, delta: 1 }));
          return;
        case 'ArrowUp':
          move(stepIndex({ items, from: activeIndex, delta: -1 }));
          return;
        case 'PageDown':
          move(stepIndex({ items, from: activeIndex, delta: PAGE }));
          return;
        case 'PageUp':
          move(stepIndex({ items, from: activeIndex, delta: -PAGE }));
          return;
        case 'Home':
        case 'End':
          if (!isTypeaheadEnabled) {
            return;
          }
          move(edgeIndex({ items, isLast: event.key === 'End' }));
          return;
        case 'Enter':
          event.preventDefault();
          onCommit(activeIndex);
          return;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        case 'Tab':
          onTab();
          return;
        default:
          break;
      }
      if (!isTypeaheadEnabled) {
        return;
      }
      if (event.key === ' ' && buffer.current === '') {
        event.preventDefault();
        onCommit(activeIndex);
        return;
      }
      if (isPrintable(event)) {
        event.preventDefault();
        typeahead(event.key);
      }
    },
    [activeIndex, isOpen, isTypeaheadEnabled, items, onClose, onCommit, onOpen, onTab, typeahead],
  );

  return { activeIndex, setActiveIndex, onKeyDown };
};
