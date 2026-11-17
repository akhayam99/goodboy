import { Button } from '@goodboy/ui';
import type { Workflow } from '@goodboy/types';
import { START_KIND_COPY } from '../../startKind/startKindCopy';

type Props = {
  readonly workflow: Workflow;
  readonly isDisabled: boolean;
  readonly onUse: () => void;
};

const COPY = START_KIND_COPY.plan;

export const StartWorkflowSuggestion = ({ workflow, isDisabled, onUse }: Props) => (
  <div
    data-start-suggestion=""
    className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-meta text-muted-foreground"
  >
    <p className="min-w-0">
      {`${COPY.suggest} `}
      <span className="text-eyebrow text-foreground">{workflow.name}</span>.
    </p>
    <Button size="xs" variant="quiet" disabled={isDisabled} onClick={onUse}>
      {COPY.useIt}
    </Button>
  </div>
);
