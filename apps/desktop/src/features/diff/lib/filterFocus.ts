const FILTER_FOCUS_EVENT = 'goodboy:diff-filter-focus';

export const requestFilterFocus = (): void => {
  window.dispatchEvent(new Event(FILTER_FOCUS_EVENT));
};

export const onFilterFocusRequest = (handler: () => void): (() => void) => {
  window.addEventListener(FILTER_FOCUS_EVENT, handler);
  return () => window.removeEventListener(FILTER_FOCUS_EVENT, handler);
};
