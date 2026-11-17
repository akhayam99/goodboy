import type { StudioKind } from '../../../store';
import { studioPlaceOf } from '../../../shared/navigation/studioPlaceOf';

type Params = {
  readonly opener: HTMLElement | null;
  readonly kind: StudioKind;
};

const isFocusHeldElsewhere = (): boolean => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body || !active.isConnected) {
    return false;
  }
  return active.closest('[data-studio-frame], [inert]') === null;
};

const isFocusable = (element: HTMLElement | null): element is HTMLElement =>
  element !== null && element.isConnected && element.closest('[inert]') === null;

export const restoreStudioOpener = ({ opener, kind }: Params): void => {
  const isStudioStillOpen =
    document.querySelector(`[data-studio-frame][data-studio="${kind}"]`) !== null;
  if (isStudioStillOpen || isFocusHeldElsewhere()) {
    return;
  }
  const place = studioPlaceOf({ studio: kind });
  const door = document.querySelector<HTMLElement>(`[data-shell-rail-item="${place}"]`);
  const target = isFocusable(opener) ? opener : door;
  if (!isFocusable(target)) {
    return;
  }
  target.focus();
};
