import type { KeyboardEvent } from 'react';
import { isTypingTarget } from '../../../shared/keyboard/isTypingTarget';

const ACTIVATING_TAGS: ReadonlySet<string> = new Set(['BUTTON', 'A', 'SUMMARY']);

const isActivating = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement && ACTIVATING_TAGS.has(target.tagName);

export const isStepEnter = (event: KeyboardEvent): boolean =>
  event.key === 'Enter' &&
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  !event.shiftKey &&
  !event.nativeEvent.isComposing &&
  !isTypingTarget(event.target) &&
  !isActivating(event.target);
