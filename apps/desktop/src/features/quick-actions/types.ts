import type { AgentKind } from '../session/agent-kind';
import type { QuickActionGroup } from './grammar';

/** Optional trailing badge rendered on the right of the row. Lets a builder
 *  surface a typed marker (agent kind + role label) without coupling the
 *  popover to any specific group. */
export interface QuickActionTrailing {
  readonly label: string;
  readonly kind?: AgentKind;
}

/**
 * One selectable row in the quick-actions popover. `perform` carries the
 * behavior, exec a script, pre-fill a skill, so the popover stays a
 * generic renderer.
 */
export interface QuickActionItem {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly trailing?: QuickActionTrailing;
  readonly group: QuickActionGroup;
  readonly perform: () => void;
}
