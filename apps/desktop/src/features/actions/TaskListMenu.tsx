import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { TaskListFacts } from './kinds/taskList';

type Props = {
  readonly facts: TaskListFacts;
};

export const TaskListMenu = ({ facts }: Props) => (
  <ObjectOverflowMenu label="More task actions" target={{ kind: 'taskList', facts }} />
);
