export const isWindowInFront = (): boolean => {
  if (typeof document === 'undefined') {
    return true;
  }
  return document.visibilityState === 'visible' && document.hasFocus();
};
