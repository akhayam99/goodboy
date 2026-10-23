import { canAnimate } from '@goodboy/ui';

const TRAVEL_MS = 560;
const TRAVEL_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
const GHOST_LAYER = '2147483000';

type Params = {
  readonly selector: string;
  readonly apply: () => void;
};

type GhostParams = {
  readonly card: HTMLElement;
  readonly from: DOMRect;
};

type FlyParams = {
  readonly ghost: HTMLElement;
  readonly from: DOMRect;
  readonly selector: string;
};

const ghostOf = ({ card, from }: GhostParams): HTMLElement | null => {
  const ghost = card.cloneNode(true);
  if (!(ghost instanceof HTMLElement)) {
    return null;
  }
  ghost.removeAttribute('data-select-id');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: GHOST_LAYER,
  });
  return ghost;
};

const fly = ({ ghost, from, selector }: FlyParams): void => {
  const landed = document.querySelector<HTMLElement>(selector);
  if (landed === null) {
    return;
  }
  const to = landed.getBoundingClientRect();
  const dx = to.left - from.left;
  const dy = to.top - from.top;
  if (dx === 0 && dy === 0) {
    return;
  }
  document.body.append(ghost);
  const travel = ghost.animate(
    [{ transform: 'translate(0, 0)' }, { transform: `translate(${dx}px, ${dy}px)` }],
    { duration: TRAVEL_MS, easing: TRAVEL_EASING },
  );
  landed.animate([{ opacity: 0 }, { opacity: 0, offset: 0.9 }, { opacity: 1 }], {
    duration: TRAVEL_MS,
  });
  const land = () => ghost.remove();
  travel.onfinish = land;
  travel.oncancel = land;
};

export const travelCard = ({ selector, apply }: Params): void => {
  const card = document.querySelector<HTMLElement>(selector);
  if (card === null || !canAnimate({ element: card }) || typeof card.animate !== 'function') {
    apply();
    return;
  }
  const from = card.getBoundingClientRect();
  const ghost = ghostOf({ card, from });
  apply();
  if (ghost === null) {
    return;
  }
  requestAnimationFrame(() => fly({ ghost, from, selector }));
};
