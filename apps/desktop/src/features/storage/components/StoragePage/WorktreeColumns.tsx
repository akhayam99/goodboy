import { STORAGE_COLUMN } from './storageColumns';

type Props = {
  readonly isSelecting: boolean;
};

export const WorktreeColumns = ({ isSelecting }: Props) => (
  <div
    aria-hidden
    className="flex h-6 items-center gap-2.5 px-2 text-eyebrow text-faint-foreground"
  >
    {isSelecting ? <span className={STORAGE_COLUMN.check} /> : null}
    <span className={STORAGE_COLUMN.node} />
    <span className="min-w-0 flex-1">Branch</span>
    <span className={STORAGE_COLUMN.size}>Size</span>
    <span className={STORAGE_COLUMN.age}>Changed</span>
    <span className={STORAGE_COLUMN.status}>Status</span>
    <span className={STORAGE_COLUMN.actions} />
  </div>
);
