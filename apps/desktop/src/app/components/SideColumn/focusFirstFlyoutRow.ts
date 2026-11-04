export const focusFirstFlyoutRow = (): void => {
  document.querySelector<HTMLElement>('[data-rail-flyout] button')?.focus();
};
