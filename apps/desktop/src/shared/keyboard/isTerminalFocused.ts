export const isTerminalFocused = (): boolean => {
  const active = document.activeElement;
  return active instanceof Element && active.closest('.xterm') !== null;
};
