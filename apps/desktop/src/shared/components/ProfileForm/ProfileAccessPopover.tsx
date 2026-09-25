import { PROFILE_ACCESS, type ProfileAudience, type ProfileField } from '@goodboy/core';
import { AnchoredPopover, cn, useDropdown } from '@goodboy/ui';

type AccessRow = Readonly<{
  label: string;
  audience: ProfileAudience | null;
}>;

const ACCESS_ROWS: ReadonlyArray<AccessRow> = [
  { label: 'Planner, orchestrator', audience: 'planner' },
  { label: 'Scout, Investigator', audience: 'scout' },
  { label: 'Implementer, Tester, Docs', audience: 'implementer' },
  { label: 'Reviewer, Resolver', audience: 'reviewer' },
  { label: 'Report, Wireframe', audience: 'report' },
  { label: 'Custom', audience: 'custom' },
  { label: 'Answers for you', audience: 'questionDelegate' },
  { label: 'Summaries, names, PR drafts', audience: null },
];

const ACCESS_COLUMNS: ReadonlyArray<Readonly<{ field: ProfileField; label: string }>> = [
  { field: 'roles', label: 'Roles' },
  { field: 'aboutWork', label: 'Work' },
  { field: 'workingRules', label: 'Rules' },
  { field: 'explainMore', label: 'Explain' },
];

const reads = ({ row, field }: { readonly row: AccessRow; readonly field: ProfileField }) =>
  row.audience !== null && PROFILE_ACCESS[row.audience].includes(field);

export const ProfileAccessPopover = () => {
  const dropdown = useDropdown({ width: 'w-96', expectedWidth: 384, expectedHeight: 320 });
  return (
    <AnchoredPopover
      dropdown={dropdown}
      role="dialog"
      ariaLabel="Who reads what"
      className="flex flex-col gap-2 p-3"
      trigger={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={dropdown.open}
          onClick={dropdown.toggle}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          See who reads what
        </button>
      }
    >
      <span className="text-sm font-semibold text-foreground">Who reads what</span>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-faint-foreground">
            <th scope="col" className="py-1 text-left font-medium">
              <span className="sr-only">Agent</span>
            </th>
            {ACCESS_COLUMNS.map((column) => (
              <th key={column.field} scope="col" className="px-1 py-1 text-center font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ACCESS_ROWS.map((row) => (
            <tr key={row.label} className="even:bg-subtle">
              <th scope="row" className="py-1 pr-2 text-left font-normal text-foreground">
                {row.label}
              </th>
              {ACCESS_COLUMNS.map((column) => {
                const isRead = reads({ row, field: column.field });
                return (
                  <td
                    key={column.field}
                    aria-label={isRead ? 'reads' : 'does not read'}
                    className={cn(
                      'px-1 py-1 text-center',
                      isRead ? 'text-success' : 'text-faint-foreground',
                    )}
                  >
                    {isRead ? '✓' : '–'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <span className="text-2xs text-muted-foreground">
        Never included in anything Goodboy posts to GitHub, Linear or Slack.
      </span>
    </AnchoredPopover>
  );
};
