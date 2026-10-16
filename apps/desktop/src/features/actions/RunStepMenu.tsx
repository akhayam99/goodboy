import { ObjectOverflowMenu } from './components/ObjectOverflowMenu';
import type { RunStepFacts } from './kinds/runStep';

type Props = {
  readonly facts: RunStepFacts;
};

export const RunStepMenu = ({ facts }: Props) => (
  <ObjectOverflowMenu label="More actions" target={{ kind: 'runStep', facts }} />
);
