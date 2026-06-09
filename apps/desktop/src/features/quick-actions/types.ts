import type { AgentKind } from '../session/agent-kind';
import type { QuickActionGroup } from './grammar';

type QuickActionTrailing = {
  readonly label: string;
  readonly kind?: AgentKind;
};

export type QuickActionItem = {
  readonly id: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly trailing?: QuickActionTrailing;
  readonly group: QuickActionGroup;
  readonly perform: () => void;
};
