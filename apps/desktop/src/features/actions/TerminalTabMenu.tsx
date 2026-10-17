import type { ReactNode } from 'react';
import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { TerminalTabFacts } from './kinds/terminalTab';

type Props = {
  readonly label: string;
  readonly trigger: ReactNode;
  readonly facts: TerminalTabFacts;
};

export const TerminalTabMenu = ({ label, trigger, facts }: Props) => (
  <ObjectOverflowMenu label={label} trigger={trigger} target={{ kind: 'terminalTab', facts }} />
);
