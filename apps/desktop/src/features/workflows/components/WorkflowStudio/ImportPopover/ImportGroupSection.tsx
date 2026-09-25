import { Skeleton } from '@goodboy/ui';
import type { Workflow, WorkflowId } from '@goodboy/types';
import type { ImportGroup } from '../../WorkflowsPanel/useWorkflowImport';
import { ImportRow } from './ImportRow';

type Props = {
  readonly group: ImportGroup;
  readonly workflows: ReadonlyArray<Workflow>;
  readonly selected: ReadonlySet<WorkflowId>;
  readonly takenNames: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly onToggle: (id: WorkflowId) => void;
};

const SKELETON_ROWS = ['first', 'second'];

export const ImportGroupSection = ({
  group,
  workflows,
  selected,
  takenNames,
  disabled,
  onToggle,
}: Props) => {
  const detail =
    group.status === 'loading'
      ? 'loading'
      : group.projectNames.length > 0
        ? group.projectNames.join(', ')
        : null;
  return (
    <section aria-label={group.workspaceName} className="flex min-w-0 flex-col gap-1">
      <h3 className="flex min-w-0 items-baseline gap-1 px-1.5 text-2xs font-semibold uppercase tracking-eyebrow text-faint-foreground">
        <span className="shrink-0">{group.workspaceName}</span>
        {detail === null ? null : (
          <span className="truncate font-normal normal-case tracking-normal">{`· ${detail}`}</span>
        )}
      </h3>
      {group.status === 'loading' ? (
        <ul role="status" aria-label={`Loading ${group.workspaceName}`} className="flex flex-col">
          {SKELETON_ROWS.map((key) => (
            <li key={key} className="flex h-7 items-center gap-2 px-1.5">
              <Skeleton className="size-3.5" />
              <Skeleton className="h-2.5 w-28" />
            </li>
          ))}
        </ul>
      ) : group.status === 'failed' ? (
        <p className="px-1.5 text-2xs text-danger">{`Couldn't load workflows. ${group.error ?? ''}`}</p>
      ) : (
        <ul className="flex flex-col">
          {workflows.map((workflow) => (
            <ImportRow
              key={workflow.id}
              workflow={workflow}
              isSelected={selected.has(workflow.id)}
              isNameTaken={takenNames.has(workflow.name)}
              disabled={disabled}
              onToggle={() => onToggle(workflow.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
};
