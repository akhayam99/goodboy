import { ObjectOverflowMenu } from '../../../actions/components/ObjectOverflowMenu';
import type { ActionViewing, WorkflowRunActionTarget } from '../../../actions/types';

type Props = {
  readonly target: WorkflowRunActionTarget;
  readonly viewing: ActionViewing;
  readonly name: string;
  readonly omit: ReadonlyArray<string>;
};

export const RunOverflowMenu = ({ target, viewing, name, omit }: Props) => (
  <ObjectOverflowMenu
    target={target}
    label={`${name} run actions`}
    anchorKey={`workflow-run:${target.runId}`}
    viewing={viewing}
    size="control"
    omit={omit}
    hideWhenEmpty
  />
);
