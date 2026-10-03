import { Check } from 'lucide-react';
import type { WorkspaceId } from '@goodboy/types';
import { EmptyLine, cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { pluralize } from '../../../../shared/utils/pluralize';
import { planSize } from '../../workspaceSettings/plan';
import type { FlowSource } from '../../workspaceSettings/sources';

type Props = {
  readonly sources: ReadonlyArray<FlowSource> | null;
  readonly sourceId: WorkspaceId | null;
  readonly onPick: (id: WorkspaceId) => void;
};

export const FlowSourcePicker = ({ sources, sourceId, onPick }: Props) => {
  if (sources === null) {
    return <EmptyLine>Reading the other workspaces…</EmptyLine>;
  }
  if (sources.length === 0) {
    return <EmptyLine>There is no other workspace to copy from.</EmptyLine>;
  }
  return (
    <div role="radiogroup" aria-label="Workspace to copy from" className="flex flex-col gap-1">
      {sources.map((candidate) => {
        const isPicked = candidate.id === sourceId;
        const differs = planSize({ plan: candidate.plan });
        return (
          <button
            key={candidate.id}
            type="button"
            role="radio"
            aria-checked={isPicked}
            onClick={() => onPick(candidate.id)}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-label motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              isPicked && 'bg-selected',
            )}
          >
            <Check
              size={ICON_SIZE.row}
              aria-hidden
              className={cn('shrink-0 text-primary', !isPicked && 'invisible')}
            />
            <span className="truncate text-foreground">{candidate.name}</span>
            <span className="truncate text-secondary text-faint-foreground">
              {pluralize(candidate.projectCount, 'project')} ·{' '}
              {differs === 0 ? 'nothing different' : `${pluralize(differs, 'setting')} different`}
            </span>
          </button>
        );
      })}
    </div>
  );
};
