import type { ReactNode } from 'react';
import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { PaneClusterFacts } from './kinds/paneCluster';

type Props = {
  readonly label: string;
  readonly trigger: ReactNode;
  readonly triggerClassName?: string;
  readonly facts: PaneClusterFacts;
};

export const PaneClusterMenu = ({ label, trigger, triggerClassName, facts }: Props) => (
  <ObjectOverflowMenu
    label={label}
    trigger={trigger}
    triggerClassName={triggerClassName}
    target={{ kind: 'paneCluster', facts }}
  />
);
