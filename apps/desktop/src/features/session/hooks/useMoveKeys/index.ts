import type { RefObject } from 'react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useRowFocusKeys } from '../../../../shared/hooks/useRowFocusKeys';
import { useShortcut } from '../../../../shared/keyboard/useShortcut';
import type { OverviewMoves } from '../../central/next/overviewMovesOf';
import type { ActionCardActions } from '../../central/next/useActionCardActions';
import { isOverviewShown } from '../../isOverviewShown';

type Params = {
  readonly sessionId: SessionId;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly moves: OverviewMoves;
  readonly actionsFor: ActionCardActions['actionsFor'];
};

const MOVE = '[data-move]';

const MOVE_IN_FRONT = '[data-move-primary]';

const MOVE_VERB = '[data-move-verb]';

const HIDDEN = '[hidden], [inert], [aria-hidden="true"]';

type ContainerParams = {
  readonly container: HTMLElement | null;
};

const isIdle = (): boolean => {
  const active = document.activeElement;
  return active === null || active === document.body;
};

const moveInFrontOf = ({ container }: ContainerParams): Element | null => {
  if (container === null || container.closest(HIDDEN) !== null) {
    return null;
  }
  const active = document.activeElement;
  if (active !== null && container.contains(active)) {
    return active.closest(MOVE);
  }
  return isIdle() ? container.querySelector(MOVE_IN_FRONT) : null;
};

export const useMoveKeys = ({ sessionId, containerRef, moves, actionsFor }: Params): void => {
  const isShown = useAppStore((state) => isOverviewShown({ state, sessionId }));
  useRowFocusKeys({ containerRef, rowSelector: MOVE_VERB });

  useShortcut(
    'list.open',
    () => {
      if (!isIdle()) {
        return false;
      }
      const move = moveInFrontOf({ container: containerRef.current });
      const verb = move?.querySelector<HTMLButtonElement>(MOVE_VERB) ?? null;
      if (verb === null || verb.disabled) {
        return false;
      }
      verb.click();
      return true;
    },
    isShown,
    { canDecline: true },
  );

  useShortcut(
    'move.notNow',
    () => {
      const id = moveInFrontOf({ container: containerRef.current })?.getAttribute('data-move');
      const card = [...moves.needsYou, ...moves.next, ...moves.rest].find(
        (candidate) => candidate.id === id,
      );
      const notNow = card === undefined ? undefined : actionsFor({ card }).menu?.target.onNotNow;
      if (notNow === undefined) {
        return false;
      }
      notNow();
      return true;
    },
    isShown,
    { canDecline: true },
  );
};
