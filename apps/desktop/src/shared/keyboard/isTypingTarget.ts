export const isTextEntryTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

export const isTypingTarget = (target: EventTarget | null): boolean =>
  isTextEntryTarget(target) || (target instanceof HTMLElement && target.tagName === 'SELECT');
