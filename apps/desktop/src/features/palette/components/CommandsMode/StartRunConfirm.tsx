import { InlineConfirm } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';
import type { PaletteEntry } from '../../types';
import type { RunConfirmFact } from '../../sources/workflowEntries';

type Props = {
  readonly entry: PaletteEntry;
  readonly workflowName: string;
  readonly facts: ReadonlyArray<RunConfirmFact>;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
};

export const StartRunConfirm = ({ entry, workflowName, facts, onConfirm, onCancel }: Props) => {
  const Icon = entry.icon;
  return (
    <div className="p-3">
      <InlineConfirm
        role="primary"
        icon={<Icon size={ICON_SIZE.row} aria-hidden />}
        title={`Start a run: ${workflowName}`}
        description="Runs inside this session, on its worktree. Nothing starts until you confirm."
        confirmLabel="Start run"
        onConfirm={onConfirm}
        onCancel={onCancel}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-label">
          {facts.map((fact) => (
            <div key={fact.label} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-faint-foreground">{fact.label}</dt>
              <dd className="min-w-0 truncate text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </InlineConfirm>
    </div>
  );
};
