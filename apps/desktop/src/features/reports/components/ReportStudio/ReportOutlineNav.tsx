import { SectionHeader, cn } from '@goodboy/ui';
import type { ReportOutlineEntry } from '../../reportOutline';

type Props = {
  readonly entries: ReadonlyArray<ReportOutlineEntry>;
  readonly activeId: string | null;
  readonly showHeader: boolean;
  readonly onSelect: (id: string) => void;
};

const INDENT: Record<number, string> = {
  1: 'pl-0',
  2: 'pl-3',
  3: 'pl-6',
};

export const ReportOutlineNav = ({ entries, activeId, showHeader, onSelect }: Props) => {
  if (entries.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Report outline" className="flex min-w-0 flex-col gap-1">
      {showHeader && <SectionHeader label="Outline" />}
      <ul className="flex min-w-0 flex-col gap-0.5">
        {entries.map((entry) => (
          <li key={entry.id} className="min-w-0">
            <button
              type="button"
              onClick={() => onSelect(entry.id)}
              className={cn(
                'w-full truncate rounded-sm text-left text-secondary text-muted-foreground underline-offset-2 hover:text-foreground hover:underline',
                INDENT[entry.level] ?? 'pl-6',
                activeId === entry.id && 'font-medium text-foreground',
              )}
            >
              {entry.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
