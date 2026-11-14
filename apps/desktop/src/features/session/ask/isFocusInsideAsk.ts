const ASK_PANEL_SELECTOR = 'section[aria-label="Ask"]';

type Params = Record<never, never>;

export const isFocusInsideAsk = ({}: Params): boolean => {
  const active = document.activeElement;
  return active instanceof Element && active.closest(ASK_PANEL_SELECTOR) !== null;
};
