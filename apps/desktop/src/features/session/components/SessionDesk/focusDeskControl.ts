export const focusDeskControl = (): void => {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>('[data-desk-line-action]')?.focus();
  });
};
