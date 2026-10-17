import { ObjectOverflowList } from './components/ObjectOverflowMenu/ObjectOverflowList';
import type { NewFormFacts } from './kinds/newForm';

type Props = {
  readonly facts: NewFormFacts;
  readonly onClose: () => void;
};

const NO_OMISSIONS: ReadonlyArray<string> = [];

export const NewFormMenuList = ({ facts, onClose }: Props) => (
  <ObjectOverflowList
    target={{ kind: 'newForm', facts }}
    label="New"
    anchorKey={null}
    omit={NO_OMISSIONS}
    onClose={onClose}
  />
);
