export const captureStudioOpener = (): HTMLElement | null => {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
};
