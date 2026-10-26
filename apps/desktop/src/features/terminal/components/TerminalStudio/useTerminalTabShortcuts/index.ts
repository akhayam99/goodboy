import { useShortcut } from '../../../../../shared/keyboard/useShortcut';
import type { TerminalTab } from '../../../../../shared/types/terminal';

type Params = {
  readonly tabs: ReadonlyArray<TerminalTab>;
  readonly selectedId: string | null;
  readonly onSelect: (tab: TerminalTab) => void;
  readonly isEnabled: boolean;
  readonly isInside: () => boolean;
};

type StepParams = {
  readonly delta: number;
};

type PickParams = {
  readonly position: number;
};

const OPTIONS = { canDecline: true } as const;

export const useTerminalTabShortcuts = ({
  tabs,
  selectedId,
  onSelect,
  isEnabled,
  isInside,
}: Params): void => {
  const step = ({ delta }: StepParams): boolean => {
    const index = tabs.findIndex((tab) => tab.id === selectedId);
    if (index < 0 || tabs.length < 2 || !isInside()) {
      return false;
    }
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    if (next === undefined) {
      return false;
    }
    onSelect(next);
    return true;
  };

  const pick = ({ position }: PickParams): boolean => {
    const tab = tabs[position];
    if (tab === undefined) {
      return false;
    }
    onSelect(tab);
    return true;
  };

  useShortcut('terminal.prevTab', () => step({ delta: -1 }), isEnabled, OPTIONS);
  useShortcut('terminal.nextTab', () => step({ delta: 1 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab1', () => pick({ position: 0 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab2', () => pick({ position: 1 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab3', () => pick({ position: 2 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab4', () => pick({ position: 3 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab5', () => pick({ position: 4 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab6', () => pick({ position: 5 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab7', () => pick({ position: 6 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab8', () => pick({ position: 7 }), isEnabled, OPTIONS);
  useShortcut('terminal.tab9', () => pick({ position: 8 }), isEnabled, OPTIONS);
};
