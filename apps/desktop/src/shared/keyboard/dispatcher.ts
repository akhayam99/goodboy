import { currentPlatform } from '../platform';
import { recordShortcut } from '../utils/actionRing';
import { isTerminalFocused } from './isTerminalFocused';
import { isTextEntryTarget, isTypingTarget } from './isTypingTarget';
import { SHORTCUTS, platformCombo, type ShortcutEntry, type ShortcutId } from './registry';

type Parsed = {
  readonly code: string;
  readonly meta: boolean;
  readonly ctrl: boolean;
  readonly shift: boolean;
  readonly alt: boolean;
};

const parseCombo = (combo: string): Parsed => {
  const parts = combo.split('+');
  return {
    code: parts[parts.length - 1] ?? '',
    meta: parts.includes('cmd'),
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
};

type MatchParams = {
  readonly event: KeyboardEvent;
  readonly entry: ShortcutEntry;
};

export const eventMatches = ({ event, entry }: MatchParams): boolean => {
  const parsed = parseCombo(platformCombo({ entry }));
  const onMac = currentPlatform() === 'darwin';
  const wantsMeta = onMac ? parsed.meta : false;
  const wantsCtrl = onMac ? parsed.ctrl : parsed.ctrl || parsed.meta;
  return (
    event.code === parsed.code &&
    event.metaKey === wantsMeta &&
    event.ctrlKey === wantsCtrl &&
    event.shiftKey === parsed.shift &&
    event.altKey === parsed.alt
  );
};

type Handler = (event: KeyboardEvent) => void;

type Registration = {
  readonly id: ShortcutId;
  readonly handler: Handler;
};

const registrations = new Map<ShortcutId, Registration>();
let listening = false;

const isPlainKey = (entry: ShortcutEntry): boolean => {
  const parsed = parseCombo(platformCombo({ entry }));
  return !parsed.meta && !parsed.ctrl && !parsed.alt && !parsed.shift;
};

const MODAL_SELECTOR = '[role="dialog"][aria-modal="true"]';

const plainKeyYields = (event: KeyboardEvent): boolean =>
  event.defaultPrevented ||
  isTypingTarget(event.target) ||
  isTerminalFocused() ||
  document.querySelector(MODAL_SELECTOR) !== null;

const typingWins = (event: KeyboardEvent): boolean => {
  if (currentPlatform() === 'darwin') {
    return false;
  }
  if (event.getModifierState('AltGraph')) {
    return true;
  }
  return event.altKey && isTextEntryTarget(event.target);
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (typingWins(event)) {
    return;
  }
  for (const registration of registrations.values()) {
    const entry: ShortcutEntry = SHORTCUTS[registration.id];
    if (!eventMatches({ event, entry })) {
      continue;
    }
    if (isPlainKey(entry) && plainKeyYields(event)) {
      continue;
    }
    event.preventDefault();
    recordShortcut({ id: registration.id });
    registration.handler(event);
    return;
  }
};

const startListening = (): void => {
  if (listening || typeof window === 'undefined') {
    return;
  }
  window.addEventListener('keydown', onKeyDown);
  listening = true;
};

const stopListening = (): void => {
  if (!listening || registrations.size > 0 || typeof window === 'undefined') {
    return;
  }
  window.removeEventListener('keydown', onKeyDown);
  listening = false;
};

export const registerShortcut = (id: ShortcutId, handler: Handler): (() => void) => {
  if (import.meta.env.DEV && registrations.has(id)) {
    console.warn(`[shortcuts] ${id} registered twice, the later registration wins`);
  }
  registrations.set(id, { id, handler });
  startListening();
  return () => {
    if (registrations.get(id)?.handler === handler) {
      registrations.delete(id);
    }
    stopListening();
  };
};
