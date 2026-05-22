import type { QuickActionGroup } from './grammar';

/**
 * One selectable row in the quick-actions popover. `perform` carries the
 * behavior — exec a script, pre-fill a skill — so the popover stays a
 * generic renderer.
 */
export interface QuickActionItem {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly group: QuickActionGroup;
  readonly perform: () => void;
}
