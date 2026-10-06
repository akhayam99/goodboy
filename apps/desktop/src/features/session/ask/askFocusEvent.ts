export const ASK_FOCUS_EVENT = 'goodboy:ask-focus';

export const requestAskFocus = (): void => {
  window.dispatchEvent(new Event(ASK_FOCUS_EVENT));
};
