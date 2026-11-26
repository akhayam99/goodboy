import { lastFocusedElement } from './useLastFocused';

export const FIELD_SELECTOR = 'textarea, input, [contenteditable="true"]';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password']);

export const focusableTrigger = (): HTMLElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    return active;
  }
  return lastFocusedElement();
};

type DraftParams = {
  readonly element: HTMLElement;
};

export const hasDraft = ({ element }: DraftParams): boolean => {
  if (element instanceof HTMLTextAreaElement) {
    return element.value !== '';
  }
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(element.type) && element.value !== '';
  }
  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
    return (element.textContent ?? '') !== '';
  }
  return false;
};
