import { OVERLAY_SELECTOR } from '../../shared/keyboard/overlaySelector';

const COVER_SELECTOR = `${OVERLAY_SELECTOR}, [data-studio-slot]`;

type CoversParams = {
  readonly view: HTMLElement;
  readonly rect: DOMRect;
};

type IntersectParams = {
  readonly a: DOMRect;
  readonly b: DOMRect;
};

const intersects = ({ a, b }: IntersectParams): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export const createOverlayWatch = () => {
  let overlays: ReadonlyArray<Element> = [];
  let isDirty = true;
  const observer =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(() => {
          isDirty = true;
        });
  observer?.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['role', 'data-dropdown-portal', 'aria-multiselectable', 'data-studio-slot'],
  });

  return {
    covers: ({ view, rect }: CoversParams): boolean => {
      if (isDirty || observer === null) {
        overlays = Array.from(document.querySelectorAll(COVER_SELECTOR));
        isDirty = false;
      }
      return overlays.some(
        (overlay) =>
          overlay.isConnected &&
          !overlay.contains(view) &&
          intersects({ a: overlay.getBoundingClientRect(), b: rect }),
      );
    },
    stop: (): void => {
      observer?.disconnect();
    },
  };
};
