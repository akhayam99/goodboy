import { Checkbox } from '@goodboy/ui';
import type { ExportCounts, ExportGroups } from '@goodboy/types';
import { NAMES } from '../../../../shared/names';

type GroupKey = keyof ExportGroups;

type GroupRow = {
  readonly key: GroupKey;
  readonly label: string;
  readonly help: string;
  readonly count?: (counts: ExportCounts) => number;
};

const GROUP_ROWS: ReadonlyArray<GroupRow> = [
  {
    key: 'workspaces',
    label: 'Workspaces',
    help: 'Defaults for new sessions, review replies, attribution',
    count: (counts) => counts.workspaces,
  },
  {
    key: 'projects',
    label: 'Projects',
    help: 'Name, type, description, star, base branch',
    count: (counts) => counts.projects,
  },
  {
    key: 'folderPaths',
    label: 'Folder paths',
    help: 'Contains your username. On this Mac, Goodboy finds them on its own',
  },
  {
    key: 'profile',
    label: 'Your profile',
    help: 'Describes you and how you work',
  },
  {
    key: 'workflowsYours',
    label: 'Workflows you made',
    help: 'Goal, process and every step, never the ones you deleted',
    count: (counts) => counts.phaseTemplates,
  },
  {
    key: 'workflowsOrchestrated',
    label: 'Workflows the orchestrator wrote',
    help: 'Disposable, made for one case',
  },
  {
    key: 'scripts',
    label: 'Saved scripts',
    help: 'Name and command, per project',
    count: (counts) => counts.scripts,
  },
  {
    key: 'permissionRules',
    label: 'Permission rules',
    help: 'Global and workspace rules, never session rules',
    count: (counts) => counts.permissionRules,
  },
  {
    key: 'budgetRules',
    label: NAMES.spendCaps,
    help: 'Caps and thresholds per provider',
    count: (counts) => counts.budgetRules,
  },
  {
    key: 'integrations',
    label: 'Linked integrations',
    help: 'Which tool is linked to which workspace, without credentials',
    count: (counts) => counts.toolBindings,
  },
  {
    key: 'appPreferences',
    label: 'App preferences',
    help: 'Default editor and hidden models',
  },
];

type Props = {
  readonly groups: ExportGroups;
  readonly counts: ExportCounts | null;
  readonly disabled: boolean;
  readonly onChange: (params: { readonly group: GroupKey; readonly value: boolean }) => void;
};

export const ExportGroupsSection = ({ groups, counts, disabled, onChange }: Props) => (
  <ul className="flex flex-col gap-1.5">
    {GROUP_ROWS.map((row) => (
      <li key={row.key} className="flex items-start justify-between gap-3 rounded-md p-1.5">
        <Checkbox
          label={
            <span className="flex flex-col gap-0.5">
              <span className="text-label text-foreground">{row.label}</span>
              <span className="text-secondary text-muted-foreground">{row.help}</span>
            </span>
          }
          checked={groups[row.key]}
          disabled={disabled}
          onChange={(value) => onChange({ group: row.key, value })}
        />
        {row.count !== undefined && counts !== null && (
          <span className="shrink-0 text-label tabular-nums text-faint-foreground">
            {row.count(counts)}
          </span>
        )}
      </li>
    ))}
  </ul>
);
