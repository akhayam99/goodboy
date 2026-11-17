import { useCallback, type KeyboardEvent } from 'react';
import { brandId, type SessionId } from '@goodboy/types';
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

type CardParams = {
  readonly card: Element | undefined;
};

const CARD = '[data-select-id]';

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
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
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
        delta: event.key === 'ArrowDown' ? 1 : -1,
        isExtending: event.shiftKey,
      });
    },
    [move],
  );
};
