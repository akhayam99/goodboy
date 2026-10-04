import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../shared/components/conceptIcons';
import { openWorkflowRules } from '../../../openWorkflowRules';

type Props = {
  readonly changed: ReadonlyArray<string>;
};

export const FromRulesRow = ({ changed }: Props) =>
  changed.length === 0 ? null : (
    <div
      data-testid="from-your-rules"
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-border-soft bg-subtle px-3 py-2 text-label"
    >
      <span className="inline-flex shrink-0 items-center gap-2 text-foreground">
        <SlidersHorizontal size={ICON_SIZE.row} aria-hidden className="text-muted-foreground" />
        From your rules
      </span>
      <span
        data-testid="run-changes"
        className="inline-flex min-w-0 flex-1 items-center gap-1 text-meta text-info"
      >
        <span aria-hidden className="block size-1.5 shrink-0 rounded-full bg-info" />
        Changed for this run: {changed.join(', ')}
      </span>
      <Button variant="ghost" size="sm" onClick={openWorkflowRules}>
        Edit
      </Button>
    </div>
  );
