import { useCallback, type KeyboardEvent } from 'react';
import { brandId, type SessionId } from '@goodboy/types';
import { eventMatches } from '../../../../../shared/keyboard/dispatcher';
import { SHORTCUTS } from '../../../../../shared/keyboard/registry';
import type { BoardSelection } from '../useBoardSelection';

type Params = {
  readonly selection: Pick<BoardSelection, 'onToggle' | 'selectedIds'>;
};

type MoveParams = {
  readonly lane: Element;
  readonly from: Element;
  readonly delta: number;
  readonly isExtending: boolean;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLElement>;
};

type CardParams = {
  readonly card: Element | undefined;
};

const CARD = '[data-select-id]';

const deltaOf = ({ event }: KeyParams): number => {
  if (
    event.key === 'ArrowDown' ||
    eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['list.next'] })
  ) {
    return 1;
  }
  if (
    event.key === 'ArrowUp' ||
    eventMatches({ event: event.nativeEvent, entry: SHORTCUTS['list.previous'] })
  ) {
    return -1;
  }
  return 0;
};

const cardIdOf = ({ card }: CardParams): SessionId | undefined => {
  const value = card?.getAttribute('data-select-id');
  if (value === null || value === undefined) {
    return undefined;
  }
  return brandId<SessionId>({ value });
};

export const useBoardArrowKeys = ({ selection }: Params) => {
  const { onToggle, selectedIds } = selection;

  const move = useCallback(
    ({ lane, from, delta, isExtending }: MoveParams) => {
      const cards = [...lane.querySelectorAll(CARD)];
      const index = cards.indexOf(from);
      const next = cards[Math.max(0, Math.min(cards.length - 1, index + delta))];
      if (next === undefined || index === -1) {
        return;
      }
      const fromId = cardIdOf({ card: from });
      const toId = cardIdOf({ card: next });
      if (isExtending && fromId !== undefined && toId !== undefined && fromId !== toId) {
        if (selectedIds.length === 0) {
          onToggle(fromId);
        }
        onToggle(toId, { shiftKey: true });
      }
      next.querySelector<HTMLElement>('button')?.focus();
    },
    [onToggle, selectedIds],
  );

  return useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const delta = deltaOf({ event });
      if (delta === 0) {
        return;
      }
      const { target } = event;
      if (!(target instanceof HTMLElement) || target.tagName === 'INPUT') {
        return;
      }
      const from = target.closest(CARD);
      const lane = from?.closest('[role="group"]');
      if (from === null || from === undefined || lane === null || lane === undefined) {
        return;
      }
      event.preventDefault();
      move({
        lane,
        from,
        delta,
        isExtending: event.shiftKey,
      });
    },
    [move],
  );
};
