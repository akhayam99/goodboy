import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { WorkflowListFacts } from './kinds/workflowList';

type Props = {
  readonly facts: WorkflowListFacts;
};

export const WorkflowListMenu = ({ facts }: Props) => (
  <ObjectOverflowMenu label="More workflow actions" target={{ kind: 'workflowList', facts }} />
);
