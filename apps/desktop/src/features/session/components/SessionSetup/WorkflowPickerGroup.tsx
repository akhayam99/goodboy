import type { LucideIcon } from 'lucide-react';
import { Eyebrow } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../shared/components/conceptIcons';

export type WorkflowPickerRow = {
  readonly key: string;
  readonly name: string;
  readonly line: string;
  readonly meta: string | null;
  readonly icon: LucideIcon;
  readonly onPick: () => void;
};

type Props = {
  readonly label: string;
  readonly rows: ReadonlyArray<WorkflowPickerRow>;
};

export const WorkflowPickerGroup = ({ label, rows }: Props) => {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Eyebrow label={label} className="px-2" />
      <ul aria-label={label} className="flex flex-col">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.key}>
              <button
                type="button"
                onClick={row.onPick}
                aria-label={row.name}
                className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Icon size={ICON_SIZE.row} aria-hidden className="shrink-0 text-muted-foreground" />
                <span className="shrink-0 text-body text-foreground">{row.name}</span>
                <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">
                  {row.line}
                </span>
                {row.meta === null ? null : (
                  <span className="shrink-0 text-secondary tabular-nums text-faint-foreground">
                    {row.meta}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
