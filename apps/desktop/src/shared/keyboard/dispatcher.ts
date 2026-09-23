import { currentPlatform } from '../platform';
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

type Registration = {
  readonly id: ShortcutId;
  readonly handler: () => void;
};

const registrations = new Map<ShortcutId, Registration>();
let listening = false;

const isEditableTarget = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');

const typingWins = (event: KeyboardEvent): boolean => {
  if (currentPlatform() === 'darwin') {
    return false;
  }
  if (event.getModifierState('AltGraph')) {
    return true;
  }
  return event.altKey && isEditableTarget(event.target);
};

const onKeyDown = (event: KeyboardEvent): void => {
  if (typingWins(event)) {
    return;
  }
  for (const registration of registrations.values()) {
    if (!eventMatches({ event, entry: SHORTCUTS[registration.id] })) {
      continue;
    }
    event.preventDefault();
    registration.handler();
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

export const registerShortcut = (id: ShortcutId, handler: () => void): (() => void) => {
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
