import type { RailFlyoutKey } from './useRailFlyout';

type Params = {
  readonly flyoutKey: RailFlyoutKey;
};

export const focusFirstFlyoutRow = ({ flyoutKey }: Params): void => {
  document.querySelector<HTMLElement>(`[data-rail-flyout="${flyoutKey}"] button`)?.focus();
};
