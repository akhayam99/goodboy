import { FACE_SWAP_ATTRIBUTE, SPLIT_DRAG_ATTRIBUTE } from '@goodboy/ui';
import { OVERLAY_SELECTOR } from '../../shared/keyboard/overlaySelector';

const PANEL_OVER_PAGE = '[data-panel-over-page], [data-rail-over-page]';

const COVER_SELECTOR = [
  OVERLAY_SELECTOR,
  '[data-dropdown-portal] > *',
  '[role="tooltip"]',
  '[data-studio-slot]',
  PANEL_OVER_PAGE,
].join(', ');

const DIALOG_SELECTOR = '[role="dialog"], [role="alertdialog"]';

export type CoverReason = 'menu' | 'dialog' | 'tooltip' | 'page' | 'drag' | 'swap';

type ReasonOfParams = {
  readonly overlay: Element;
};

type CoversParams = {
  readonly view: HTMLElement;
  readonly rect: DOMRect;
};

type IntersectParams = {
  readonly a: DOMRect;
  readonly b: DOMRect;
};

type ReachParams = {
  readonly overlay: Element;
  readonly view: HTMLElement;
};

const isUnderSlot = ({ overlay, view }: ReachParams): boolean =>
  !overlay.matches('[data-studio-slot]') || overlay.parentElement?.contains(view) === true;

const intersects = ({ a, b }: IntersectParams): boolean =>
  a.width > 0 &&
  a.height > 0 &&
  a.left < b.right &&
  b.left < a.right &&
  a.top < b.bottom &&
  b.top < a.bottom;

const reasonOf = ({ overlay }: ReasonOfParams): CoverReason => {
  if (overlay.matches(`[data-studio-slot], ${PANEL_OVER_PAGE}`)) {
    return 'page';
  }
  if (overlay.matches('[role="tooltip"]')) {
    return 'tooltip';
  }
  return overlay.matches(DIALOG_SELECTOR) ? 'dialog' : 'menu';
};

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
    attributeFilter: [
      'role',
      'data-dropdown-portal',
      'aria-multiselectable',
      'data-studio-slot',
      'data-panel-over-page',
      'data-rail-over-page',
    ],
  });

  const coverOf = ({ view, rect }: CoversParams): CoverReason | null => {
    if (document.body.hasAttribute(FACE_SWAP_ATTRIBUTE)) {
      return 'swap';
    }
    if (document.body.hasAttribute(SPLIT_DRAG_ATTRIBUTE)) {
      return 'drag';
    }
    if (isDirty || observer === null) {
      overlays = Array.from(document.querySelectorAll(COVER_SELECTOR));
      isDirty = false;
    }
    const found = overlays.find(
      (overlay) =>
        overlay.isConnected &&
        overlay.matches(COVER_SELECTOR) &&
        !overlay.contains(view) &&
        isUnderSlot({ overlay, view }) &&
        intersects({ a: overlay.getBoundingClientRect(), b: rect }),
    );
    return found === undefined ? null : reasonOf({ overlay: found });
  };

  return {
    coverOf,
    covers: ({ view, rect }: CoversParams): boolean => coverOf({ view, rect }) !== null,
    stop: (): void => {
      observer?.disconnect();
    },
  };
};
