import { useEffect } from 'react';

export type ShortcutScope = 'global' | 'dialog';

export interface ShortcutOptions {
  /** Prevent firing when focus is inside an input/textarea/select/contenteditable. */
  ignoreInInputs?: boolean;
  scope?: ShortcutScope;
}

export interface ShortcutCombo {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** Registry slot reserved for cmd+K command palette (#297, not yet implemented). */
export const RESERVED_CMD_K: ShortcutCombo = { key: 'k', meta: true };

function parseCombo(combo: string): ShortcutCombo {
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';
  return {
    key: key === 'comma' ? ',' : key === 'period' ? '.' : key === 'slash' ? '/' : key,
    meta: parts.includes('cmd') || parts.includes('meta'),
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

function comboMatches(e: KeyboardEvent, combo: ShortcutCombo): boolean {
  return (
    e.key.toLowerCase() === combo.key &&
    Boolean(e.metaKey) === Boolean(combo.meta) &&
    Boolean(e.ctrlKey) === Boolean(combo.ctrl) &&
    Boolean(e.shiftKey) === Boolean(combo.shift) &&
    Boolean(e.altKey) === Boolean(combo.alt)
  );
}

function isFocusInInput(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/**
 * Binds a keyboard shortcut globally on window.
 *
 * combo format: "cmd+,", "cmd+/", "cmd+.", "escape"
 * Meta key (cmd) shortcuts are silently skipped when focus is inside
 * an input/textarea/select/contenteditable, so they never steal native
 * text-editing shortcuts.
 */
export function useKeyboardShortcut(
  combo: string,
  handler: () => void,
  options: ShortcutOptions = {},
): void {
  const { ignoreInInputs = true } = options;

  useEffect(() => {
    const parsed = parseCombo(combo);

    const onKeyDown = (e: KeyboardEvent) => {
      if (!comboMatches(e, parsed)) return;
      if (ignoreInInputs && parsed.meta && isFocusInInput()) return;
      e.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [combo, handler, ignoreInInputs]);
}
