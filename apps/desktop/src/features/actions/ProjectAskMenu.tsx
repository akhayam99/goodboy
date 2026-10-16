import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { ProjectAskFacts } from './kinds/projectAsk';

type Props = {
  readonly facts: ProjectAskFacts;
};

export const ProjectAskMenu = ({ facts }: Props) => (
  <ObjectOverflowMenu
    label="More request actions"
    size="control"
    align="left"
    target={{ kind: 'projectAsk', facts }}
  />
);
