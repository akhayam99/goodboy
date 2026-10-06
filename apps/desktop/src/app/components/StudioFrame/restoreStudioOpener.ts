import type { StudioKind } from '../../../store';

type Params = {
  readonly opener: HTMLElement | null;
  readonly kind: StudioKind;
};

const isFocusHeldElsewhere = (): boolean => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body || !active.isConnected) {
    return false;
  }
  return active.closest('[data-studio-frame], [data-settings-column], [inert]') === null;
};

const isFocusable = (element: HTMLElement | null): element is HTMLElement =>
  element !== null && element.isConnected && element.closest('[inert]') === null;

export const restoreStudioOpener = ({ opener, kind }: Params): void => {
  if (isFocusHeldElsewhere()) {
    return;
  }
  const door = document.querySelector<HTMLElement>(`[data-column-door="${kind}"]`);
  const target = isFocusable(opener) ? opener : door;
  if (!isFocusable(target)) {
    return;
  }
  target.focus();
};
