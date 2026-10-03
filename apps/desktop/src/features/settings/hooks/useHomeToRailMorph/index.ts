import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

const MORPH_MS = 230;
const MORPH_EASING = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
const CARD_SELECTOR = 'button[data-settings-page]';

type Box = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

type CapturedCard = {
  readonly key: string;
  readonly group: string;
  readonly box: Box;
  readonly node: HTMLElement;
};

type Capture = {
  readonly cards: ReadonlyArray<CapturedCard>;
};

type Params = {
  readonly stageRef: RefObject<HTMLElement | null>;
};

const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canAnimate = (): boolean =>
  !prefersReducedMotion() && typeof HTMLElement.prototype.animate === 'function';

const boxOf = ({ element, stage }: { readonly element: Element; readonly stage: Element }): Box => {
  const origin = stage.getBoundingClientRect();
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - origin.left,
    top: rect.top - origin.top,
    width: rect.width,
    height: rect.height,
  };
};

const px = (value: number): string => `${value}px`;

const frameOf = ({ box, radius }: { readonly box: Box; readonly radius: string }): Keyframe => ({
  left: px(box.left),
  top: px(box.top),
  width: px(box.width),
  height: px(box.height),
  borderRadius: radius,
});

const railTargetOf = ({
  stage,
  card,
}: {
  readonly stage: HTMLElement;
  readonly card: CapturedCard;
}): { readonly element: Element; readonly isRow: boolean } | null => {
  const rail = stage.querySelector('nav[aria-label="Settings scopes"]');
  if (rail === null) {
    return null;
  }
  const row = rail.querySelector(`[data-settings-page="${card.key}"] button`);
  if (row !== null) {
    return { element: row, isRow: true };
  }
  const group = rail.querySelector(`[data-settings-group="${card.group}"] button`);
  return group === null ? null : { element: group, isRow: false };
};

const flyCard = ({
  layer,
  stage,
  card,
}: {
  readonly layer: HTMLElement;
  readonly stage: HTMLElement;
  readonly card: CapturedCard;
}): ReadonlyArray<Animation> => {
  const target = railTargetOf({ stage, card });
  if (target === null) {
    return [];
  }
  const flyer = card.node;
  flyer.removeAttribute('data-settings-page');
  flyer.tabIndex = -1;
  flyer.style.position = 'absolute';
  flyer.style.margin = '0';
  layer.appendChild(flyer);
  const timing: KeyframeAnimationOptions = {
    duration: MORPH_MS,
    easing: MORPH_EASING,
    fill: 'both',
  };
  const to = boxOf({ element: target.element, stage });
  const fades: KeyframeAnimationOptions = { duration: MORPH_MS * 0.4, fill: 'both' };
  const tile = flyer.querySelector('[data-settings-tile]');
  const status = flyer.querySelector('[data-settings-status]');
  const last = flyer.querySelector('[data-settings-last]');
  return [
    flyer.animate(
      [frameOf({ box: card.box, radius: '8px' }), frameOf({ box: to, radius: '6px' })],
      timing,
    ),
    ...(target.isRow ? [] : [flyer.animate([{ opacity: 1 }, { opacity: 0 }], fades)]),
    ...(tile === null
      ? []
      : [
          tile.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(0.6)', opacity: 0.8 }],
            timing,
          ),
        ]),
    ...(status === null ? [] : [status.animate([{ opacity: 1 }, { opacity: 0 }], fades)]),
    ...(last === null ? [] : [last.animate([{ opacity: 1 }, { opacity: 0 }], fades)]),
  ];
};

export const useHomeToRailMorph = ({ stageRef }: Params) => {
  const [capture, setCapture] = useState<Capture | null>(null);

  const begin = useCallback((): void => {
    const stage = stageRef.current;
    if (stage === null || !canAnimate()) {
      return;
    }
    const cards = Array.from(stage.querySelectorAll<HTMLElement>(CARD_SELECTOR)).map(
      (card): CapturedCard => {
        const node = card.cloneNode(true);
        return {
          key: card.dataset.settingsPage ?? '',
          group: card.closest('section')?.dataset.settingsGroup ?? '',
          box: boxOf({ element: card, stage }),
          node: node instanceof HTMLElement ? node : document.createElement('span'),
        };
      },
    );
    setCapture({ cards });
  }, [stageRef]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (capture === null || stage === null) {
      return;
    }
    const rail = stage.querySelector<HTMLElement>('nav[aria-label="Settings scopes"]');
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset.settingsMorph = '';
    layer.style.position = 'absolute';
    layer.style.inset = '0';
    layer.style.pointerEvents = 'none';
    layer.style.zIndex = '20';
    stage.appendChild(layer);
    rail?.style.setProperty('opacity', '0');
    const animations = capture.cards.flatMap((card) => flyCard({ layer, stage, card }));
    let isDone = false;
    const finish = () => {
      if (isDone) {
        return;
      }
      isDone = true;
      animations.forEach((animation) => animation.cancel());
      layer.remove();
      rail?.style.removeProperty('opacity');
    };
    void Promise.all(animations.map((animation) => animation.finished))
      .catch(() => undefined)
      .then(() => {
        finish();
        setCapture((current) => (current === capture ? null : current));
      });
    return finish;
  }, [capture, stageRef]);

  return { begin, isMorphing: capture !== null };
};
